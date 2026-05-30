import { pgTableCreator } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `${name}`);

export const betterAuthUser = createTable("ba_user", (d) => ({
    id: d.text().notNull().primaryKey(),
    name: d.text().notNull(),
    email: d.text().notNull().unique(),
    emailVerified: d.boolean().notNull(),
    image: d.text(),
    createdAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
    updatedAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
}));

export const betterAuthSession = createTable("ba_session", (d) => ({
    id: d.text().notNull().primaryKey(),
    expiresAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
    token: d.text().notNull().unique(),
    createdAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
    updatedAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
    ipAddress: d.text(),
    userAgent: d.text(),
    userId: d
        .text()
        .notNull()
        .references(() => betterAuthUser.id),
}));

export const betterAuthAccount = createTable("ba_account", (d) => ({
    id: d.text().notNull().primaryKey(),
    accountId: d.text().notNull(),
    providerId: d.text().notNull(),
    userId: d
        .text()
        .notNull()
        .references(() => betterAuthUser.id),
    accessToken: d.text(),
    refreshToken: d.text(),
    idToken: d.text(),
    accessTokenExpiresAt: d.timestamp({ withTimezone: true, mode: "date" }),
    refreshTokenExpiresAt: d.timestamp({ withTimezone: true, mode: "date" }),
    scope: d.text(),
    password: d.text(),
    createdAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
    updatedAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
}));

export const betterAuthVerification = createTable("ba_verification", (d) => ({
    id: d.text().notNull().primaryKey(),
    identifier: d.text().notNull(),
    value: d.text().notNull(),
    expiresAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
    createdAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
    updatedAt: d.timestamp({ withTimezone: true, mode: "date" }).notNull(),
}));
