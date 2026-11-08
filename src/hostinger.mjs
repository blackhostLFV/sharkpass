import {runOfficialEventTask,runOfficialPublishTask} from "./official-event-setup.mjs";
// Dedicated entry for managed hosts that import the configured startup file.
import { createApp } from "./server.mjs";
import { backupBeforeMigration } from "./migration-backup.mjs";
import { reportPlatformAdminCandidate } from "./platform-admin-lookup.mjs";
import { runAdminGrantTask } from "./admin-grant-task.mjs";
import { runEventSetupTask } from "./launch-events.mjs";

backupBeforeMigration(process.env.DATABASE_PATH ?? "data/sharkpass.sqlite", "202611070005_seat_blocks.sql");

const { server, store, payments, mailer } = createApp();
reportPlatformAdminCandidate(store, process.env.SHARKPASS_ADMIN_LOOKUP_USERNAME);
if (process.env.SHARKPASS_INITIAL_ADMIN_USER_ID) {
  const userId = process.env.SHARKPASS_INITIAL_ADMIN_USER_ID;
  const result = store.initializePlatformAdmin(userId);
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "INFO",
    message: JSON.stringify({operation: "platform_admin_activation", changed: result.changed, active: store.isPlatformAdmin({id:userId})}),
  }));
}
runEventSetupTask(store);
runAdminGrantTask(store);
runOfficialEventTask(store);
runOfficialPublishTask(store,{paymentMode:payments.config?.mode,emailConfigured:mailer.configured});
server.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? "0.0.0.0", () => {
  console.log("SharkPass managed server ready.");
});
