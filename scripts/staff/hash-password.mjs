import { createInterface } from 'node:readline/promises';
import { hashPassword, roles as knownRoles } from '../../server/app.js';

const [, , email, rolesArg] = process.argv;

if (!email || !email.includes('@')) {
  console.error('Использование: npm run staff:hash-password -- you@sakhatube.ru [superadmin,content_editor,...]');
  process.exit(1);
}

const roles = (rolesArg ? rolesArg.split(',') : ['superadmin']).map((role) => role.trim());
const invalidRole = roles.find((role) => !knownRoles.includes(role));
if (invalidRole) {
  console.error(`Неизвестная роль "${invalidRole}". Допустимые: ${knownRoles.join(', ')}`);
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question('Пароль для сотрудника (виден при вводе — не запускай при включённой записи экрана): ');
rl.close();

if (password.length < 8) {
  console.error('Пароль должен быть не короче 8 символов.');
  process.exit(1);
}

const passwordHash = await hashPassword(password);
const entry = { email: email.toLowerCase(), passwordHash, roles };

console.log('\nДобавь эту запись в массив STAFF_ACCOUNTS_JSON на Railway (сервис sakhatube → Variables):\n');
console.log(JSON.stringify(entry, null, 2));
console.log('\nЕсли переменная уже содержит другие аккаунты — добавь эту запись в существующий массив, а не замени его.');
