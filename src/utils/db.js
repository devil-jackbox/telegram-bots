const mongoose = require('mongoose');

let isConnected = false;

async function connectMongo() {
  if (isConnected) return mongoose.connection;
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bot_platform';
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || undefined });
  isConnected = true;
  return mongoose.connection;
}

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password_hash: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const metricSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: { type: Number, default: 0 },
  updated_at: { type: Date, default: Date.now }
});

const scheduleSchema = new mongoose.Schema({
  bot_id: { type: String, required: true },
  action: { type: String, enum: ['start','stop'], required: true },
  cron: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Metric = mongoose.models.Metric || mongoose.model('Metric', metricSchema);
const Schedule = mongoose.models.Schedule || mongoose.model('Schedule', scheduleSchema);

// Version snapshots for bots
const versionSchema = new mongoose.Schema({
  bot_id: { type: String, required: true },
  label: { type: String },
  code: { type: String },
  files: [{ path: String, content: String }],
  environmentVariables: [{ key: String, value: String, isSecret: Boolean }],
  created_at: { type: Date, default: Date.now }
});

const Version = mongoose.models.Version || mongoose.model('Version', versionSchema);

async function incMetric(key, by = 1) {
  await connectMongo();
  const now = new Date();
  await Metric.updateOne({ key }, { $inc: { value: by }, $set: { updated_at: now } }, { upsert: true });
}

async function getMetrics() {
  await connectMongo();
  const rows = await Metric.find({}).lean();
  return rows;
}

module.exports = { connectMongo, User, Metric, Schedule, Version, incMetric, getMetrics };

