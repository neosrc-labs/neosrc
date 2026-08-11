import { relations } from "drizzle-orm/relations";
import { baUser, baAccount, baSession, apiKey, apiKeyPermission, account, repo } from "./schema";

export const baAccountRelations = relations(baAccount, ({one}) => ({
	baUser: one(baUser, {
		fields: [baAccount.userId],
		references: [baUser.id]
	}),
}));

export const baUserRelations = relations(baUser, ({many}) => ({
	baAccounts: many(baAccount),
	baSessions: many(baSession),
	apiKeys: many(apiKey),
}));

export const baSessionRelations = relations(baSession, ({one}) => ({
	baUser: one(baUser, {
		fields: [baSession.userId],
		references: [baUser.id]
	}),
}));

export const apiKeyRelations = relations(apiKey, ({one, many}) => ({
	baUser: one(baUser, {
		fields: [apiKey.owner],
		references: [baUser.id]
	}),
	apiKeyPermissions: many(apiKeyPermission),
}));

export const apiKeyPermissionRelations = relations(apiKeyPermission, ({one}) => ({
	apiKey: one(apiKey, {
		fields: [apiKeyPermission.apiKeyId],
		references: [apiKey.id]
	}),
}));

export const repoRelations = relations(repo, ({one}) => ({
	account: one(account, {
		fields: [repo.accountId],
		references: [account.id]
	}),
}));

export const accountRelations = relations(account, ({many}) => ({
	repos: many(repo),
}));