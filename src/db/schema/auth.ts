import {boolean, index, pgEnum, pgTable, text, timestamp} from "drizzle-orm/pg-core";
import {relations} from "drizzle-orm";

// Same timestamps pattern as db/schema/app.ts.
// Better Auth's core schema only requires that createdAt/updatedAt exist and are
// non-null Dates, so the docs do not override this pattern.
const timestamps = {
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().$onUpdate(() => new Date()).notNull()
}

// Extra (non-Better-Auth) field. Enum is declared once and reused on user.role.
export const roleEnum = pgEnum('role', ['student', 'teacher', 'admin'])

export const user = pgTable('user', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('emailVerified').default(false).notNull(),
    image: text('image'),
    // --- two extra fields beyond the Better Auth core schema ---
    role: roleEnum('role').default('student').notNull(),
    imageCldPubId: text('imageCldPubId'),
    ...timestamps
})

export const session = pgTable('session', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull().references(() => user.id, {onDelete: 'cascade'}),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expiresAt').notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    ...timestamps
}, (table) => [
    index('session_userId_idx').on(table.userId)
])

export const account = pgTable('account', {
    id: text('id').primaryKey(),
    userId: text('userId').notNull().references(() => user.id, {onDelete: 'cascade'}),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
    refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
    scope: text('scope'),
    idToken: text('idToken'),
    password: text('password'),
    ...timestamps
}, (table) => [
    index('account_userId_idx').on(table.userId)
])

export const verification = pgTable('verification', {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expiresAt').notNull(),
    ...timestamps
}, (table) => [
    index('verification_identifier_idx').on(table.identifier)
])

export const userRelations = relations(user, ({many}) => ({
    sessions: many(session),
    accounts: many(account)
}))

export const sessionRelations = relations(session, ({one}) => ({
    user: one(user, {
        fields: [session.userId],
        references: [user.id]
    })
}))

export const accountRelations = relations(account, ({one}) => ({
    user: one(user, {
        fields: [account.userId],
        references: [user.id]
    })
}))

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
