import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
if(existsSync('.env')) throw new Error('.env already exists; edit it directly.');
const secret=()=>randomBytes(32).toString('hex');
writeFileSync('.env',`DB_HOST=db
DB_PORT=3306
DB_NAME=workspace
DB_USER=workspace
DB_PASSWORD=${secret()}
DB_ROOT_PASSWORD=${secret()}
APP_KEY=${secret()}
ADMIN_EMAIL=owner@example.com
ADMIN_NAME=Workspace Owner
ADMIN_PASSWORD=${secret()}
PUBLIC_API_URL=http://localhost:8080/api
FRONTEND_ORIGIN=
`,{mode:0o600});
console.log('Created private .env with unique secrets. Edit ADMIN_EMAIL and ADMIN_PASSWORD before starting.');
