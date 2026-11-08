"""Install SharkPass on the office host as a separate rootless service."""
from pathlib import Path
import os,subprocess,shlex
from ipaddress import ip_address,ip_network
ROOT=Path(os.environ.get('SHARKPASS_DEPLOY_ROOT',str(Path.home()/'.local/share/sharkpass')))
BIND=os.environ.get('SHARKPASS_BIND_ADDRESS','127.0.0.1')
address=ip_address(BIND)
if not (address.version==4 and (address.is_loopback or address in ip_network('100.64.0.0/10'))):raise SystemExit('Use a loopback or private Tailscale IPv4 address')
PUBLIC_URL=os.environ.get('PUBLIC_URL',f'http://{BIND}:3200')
SOURCE=ROOT/'source'
DATA=ROOT/'data'
POD=['/usr/bin/podman','--root',str(DATA/'containers'),'--runroot',f'/run/user/{os.getuid()}/sharkpass-containers']
if os.getuid()==0:raise SystemExit('Run as the office user, not root')
os.umask(0o077)
DATA.mkdir(parents=True,exist_ok=True)
(DATA/'application').mkdir(exist_ok=True)
subprocess.run(POD+['build','-t','localhost/sharkpass:pilot',str(SOURCE)],check=True)
units=Path.home()/'.config/systemd/user'
command=POD+['run','--rm','--name','sharkpass','--memory','256m','--log-opt','max-size=10mb','-p',f'{BIND}:3200:3000','-e',f'PUBLIC_URL={PUBLIC_URL}','-v',f'{DATA}/application:/data:Z,U','localhost/sharkpass:pilot']
(units/'sharkpass.service').write_text(f'''[Unit]
Description=SharkPass private ticketing pilot
After=network-online.target
StartLimitIntervalSec=0
[Service]
ExecStart={shlex.join(command)}
ExecStop={shlex.join(POD+['stop','-t','20','sharkpass'])}
Restart=always
RestartSec=10
TimeoutStartSec=180
[Install]
WantedBy=default.target
''')
(units/'sharkpass-backup.service').write_text(f'''[Unit]
Description=SharkPass backup and integrity verification
After=sharkpass.service
Requires=sharkpass.service
[Service]
Type=oneshot
ExecStart={shlex.join(POD+['exec','sharkpass','node','--experimental-sqlite','src/backup.mjs'])}
''')
(units/'sharkpass-backup.timer').write_text('''[Unit]
Description=SharkPass backup at 02:15 America/Bogota
[Timer]
OnCalendar=*-*-* 07:15:00 UTC
Persistent=true
[Install]
WantedBy=timers.target
''')
subprocess.run(['systemctl','--user','daemon-reload'],check=True)
subprocess.run(['systemctl','--user','enable','--now','sharkpass.service','sharkpass-backup.timer'],check=True)
print('SharkPass installed privately on Tailscale port 3200.')
