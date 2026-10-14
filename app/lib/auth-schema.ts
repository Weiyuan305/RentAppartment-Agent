import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("auth_user", {
  id:text("id").primaryKey(), name:text("name").notNull(), email:text("email").notNull().unique(),
  emailVerified:integer("emailVerified",{mode:"boolean"}).notNull(), image:text("image"),
  createdAt:integer("createdAt",{mode:"timestamp_ms"}).notNull(), updatedAt:integer("updatedAt",{mode:"timestamp_ms"}).notNull(),
});
export const session = sqliteTable("auth_session", {
  id:text("id").primaryKey(), expiresAt:integer("expiresAt",{mode:"timestamp_ms"}).notNull(), token:text("token").notNull().unique(),
  createdAt:integer("createdAt",{mode:"timestamp_ms"}).notNull(), updatedAt:integer("updatedAt",{mode:"timestamp_ms"}).notNull(),
  ipAddress:text("ipAddress"), userAgent:text("userAgent"), userId:text("userId").notNull().references(()=>user.id,{onDelete:"cascade"}),
}, table=>[index("auth_session_user").on(table.userId)]);
export const account = sqliteTable("auth_account", {
  id:text("id").primaryKey(), accountId:text("accountId").notNull(), providerId:text("providerId").notNull(),
  userId:text("userId").notNull().references(()=>user.id,{onDelete:"cascade"}), accessToken:text("accessToken"),refreshToken:text("refreshToken"),idToken:text("idToken"),
  accessTokenExpiresAt:integer("accessTokenExpiresAt",{mode:"timestamp_ms"}),refreshTokenExpiresAt:integer("refreshTokenExpiresAt",{mode:"timestamp_ms"}),
  scope:text("scope"), password:text("password"), createdAt:integer("createdAt",{mode:"timestamp_ms"}).notNull(),updatedAt:integer("updatedAt",{mode:"timestamp_ms"}).notNull(),
}, table=>[index("auth_account_user").on(table.userId)]);
export const verification = sqliteTable("auth_verification", {
  id:text("id").primaryKey(),identifier:text("identifier").notNull(),value:text("value").notNull(),expiresAt:integer("expiresAt",{mode:"timestamp_ms"}).notNull(),
  createdAt:integer("createdAt",{mode:"timestamp_ms"}).notNull(),updatedAt:integer("updatedAt",{mode:"timestamp_ms"}).notNull(),
}, table=>[index("auth_verification_identifier").on(table.identifier)]);
export const rateLimit = sqliteTable("auth_rate_limit", {id:text("id").primaryKey(),key:text("key").notNull().unique(),count:integer("count").notNull(),lastRequest:integer("lastRequest").notNull()});

export const authSchemaSQL = `
CREATE TABLE IF NOT EXISTS auth_user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, emailVerified INTEGER NOT NULL, image TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS auth_session (id TEXT PRIMARY KEY, expiresAt INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, ipAddress TEXT, userAgent TEXT, userId TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS auth_session_user ON auth_session(userId);
CREATE TABLE IF NOT EXISTS auth_account (id TEXT PRIMARY KEY, accountId TEXT NOT NULL, providerId TEXT NOT NULL, userId TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, accessToken TEXT, refreshToken TEXT, idToken TEXT, accessTokenExpiresAt INTEGER, refreshTokenExpiresAt INTEGER, scope TEXT, password TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS auth_account_user ON auth_account(userId);
CREATE TABLE IF NOT EXISTS auth_verification (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expiresAt INTEGER NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS auth_verification_identifier ON auth_verification(identifier);
CREATE TABLE IF NOT EXISTS auth_rate_limit (id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, count INTEGER NOT NULL, lastRequest INTEGER NOT NULL);
`;
