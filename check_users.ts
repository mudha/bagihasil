import { prisma } from './src/lib/prisma';

async function main() {
    const users = await prisma.user.findMany();
    console.log('Found users:', users.map(u => ({ email: u.email, hasPassword: !!u.passwordHash, passwordHashLength: u.passwordHash?.length })));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
