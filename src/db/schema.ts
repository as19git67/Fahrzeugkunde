import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// --- Fahrzeuge ---
export const vehicles = sqliteTable("vehicles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// --- Fahrzeugseiten (links, rechts, hinten, oben) ---
export const vehicleViews = sqliteTable("vehicle_views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  side: text("side", { enum: ["left", "right", "back", "top", "front"] }).notNull(),
  label: text("label").notNull(), // "Fahrzeug links"
  imagePath: text("image_path"),  // "/uploads/views/left.jpg"
  sortOrder: integer("sort_order").default(0),
});

// --- Rolladen / Fächer (G1, G2, ...) ---
export const compartments = sqliteTable("compartments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  viewId: integer("view_id").notNull().references(() => vehicleViews.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // "G1"
  imagePath: text("image_path"),  // "/uploads/compartments/G1_open.jpg"
  // Hotspot-Position auf dem Fahrzeugbild (prozentual 0-100)
  hotspotX: real("hotspot_x"),
  hotspotY: real("hotspot_y"),
  hotspotW: real("hotspot_w"),
  hotspotH: real("hotspot_h"),
  sortOrder: integer("sort_order").default(0),
});

// --- Positionen innerhalb eines Fachs ---
export const positions = sqliteTable("positions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  compartmentId: integer("compartment_id").notNull().references(() => compartments.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // "orange Kiste", "oben links"
  hotspotX: real("hotspot_x"),
  hotspotY: real("hotspot_y"),
  hotspotW: real("hotspot_w"),
  hotspotH: real("hotspot_h"),
  sortOrder: integer("sort_order").default(0),
});

// --- Ausrüstungsgegenstände ---
export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),            // "Seilwinde"
  description: text("description"),         // "Zum Ziehen schwerer Lasten"
  imagePath: text("image_path"),            // "/uploads/items/seilwinde.jpg"
  silhouettePath: text("silhouette_path"),  // für Dalli-Dalli Modus
  category: text("category"),              // "bergung", "atemschutz", ...
  difficulty: integer("difficulty").default(1), // 1-3
  // Verortung
  positionId: integer("position_id").references(() => positions.id),
  // Kurztext für Verortung z.B. "G1, orange Kiste"
  locationLabel: text("location_label"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// --- Benutzer ---
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  handle: text("handle").notNull().unique(),  // "FireMax"
  email: text("email").notNull().unique(),
  verified: integer("verified", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// --- Auth-Codes (Email-Code Login) ---
export const authCodes = sqliteTable("auth_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  expiresAt: text("expires_at").notNull(),
  used: integer("used", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// --- Sessions ---
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// --- Highscores ---
export const highscores = sqliteTable("highscores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  handle: text("handle").notNull(), // Snapshot des Handles
  score: integer("score").notNull(),
  mode: text("mode", { enum: ["time_attack", "speed_run"] }).notNull(),
  // time_attack: Anzahl richtiger Antworten in X Sekunden
  // speed_run: Sekunden für 20 richtige Antworten
  correctAnswers: integer("correct_answers").notNull(),
  totalAnswers: integer("total_answers").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  vehicleId: integer("vehicle_id").references(() => vehicles.id),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});
