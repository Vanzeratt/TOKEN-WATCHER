import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const walletConfigs = pgTable("wallet_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull().unique(),
  privateKey: text("private_key").notNull(),
  safeWalletAddress: text("safe_wallet_address").notNull(),
  gasStrategy: text("gas_strategy").notNull().default("standard"),
  minTransferAmount: decimal("min_transfer_amount", { precision: 18, scale: 8 }).notNull().default("10.00"),
  autoSweepEnabled: boolean("auto_sweep_enabled").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  tokenAddress: text("token_address").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  tokenName: text("token_name").notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  amountUSD: decimal("amount_usd", { precision: 18, scale: 2 }),
  txHash: text("tx_hash"),
  status: text("status").notNull().default("pending"), // pending, completed, failed
  gasUsed: decimal("gas_used", { precision: 18, scale: 8 }),
  gasPrice: decimal("gas_price", { precision: 18, scale: 0 }),
  blockNumber: text("block_number"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const tokenDetections = pgTable("token_detections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  tokenAddress: text("token_address").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  tokenName: text("token_name").notNull(),
  balance: decimal("balance", { precision: 18, scale: 8 }).notNull(),
  balanceUSD: decimal("balance_usd", { precision: 18, scale: 2 }),
  tradingEnabled: boolean("trading_enabled").notNull().default(false),
  detectedAt: timestamp("detected_at").defaultNow(),
  lastCheckedAt: timestamp("last_checked_at").defaultNow(),
});

export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  type: text("type").notNull(), // token_detected, transfer_started, transfer_completed, transfer_failed, trading_enabled
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(), // active, completed, failed, pending
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const networkStatus = pgTable("network_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  currentBlock: text("current_block").notNull(),
  gasPrice: decimal("gas_price", { precision: 18, scale: 0 }).notNull(),
  networkLoad: decimal("network_load", { precision: 5, scale: 2 }).notNull(),
  connectionStatus: text("connection_status").notNull().default("stable"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Insert schemas
export const insertWalletConfigSchema = createInsertSchema(walletConfigs).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertTokenDetectionSchema = createInsertSchema(tokenDetections).omit({
  id: true,
  detectedAt: true,
  lastCheckedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertNetworkStatusSchema = createInsertSchema(networkStatus).omit({
  id: true,
  lastUpdated: true,
});

// Types
export type WalletConfig = typeof walletConfigs.$inferSelect;
export type InsertWalletConfig = z.infer<typeof insertWalletConfigSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type TokenDetection = typeof tokenDetections.$inferSelect;
export type InsertTokenDetection = z.infer<typeof insertTokenDetectionSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type NetworkStatus = typeof networkStatus.$inferSelect;
export type InsertNetworkStatus = z.infer<typeof insertNetworkStatusSchema>;
