const mongoose = require("mongoose");
const dotenv = require("dotenv");

const TestQuestion = require("../models/TestQuestion");
const {
  DEMO_SEED_TAG,
  DEMO_SOURCE,
  buildDemoQuestions,
} = require("./demoQuestionBank");

async function seedDemoQuestionBank() {
  const deleted = await TestQuestion.deleteMany({
    source: DEMO_SOURCE,
    seedTag: DEMO_SEED_TAG,
  });

  const insertedQuestions = await TestQuestion.insertMany(buildDemoQuestions(), {
    ordered: true,
  });

  return {
    deletedCount: deleted.deletedCount,
    insertedCount: insertedQuestions.length,
  };
}

async function main() {
  dotenv.config();

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required to seed the demo question bank");
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const result = await seedDemoQuestionBank();
    console.log(`Seeded ${result.insertedCount} demo questions`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Demo question bank seed failed:", error);
    process.exit(1);
  });
}

module.exports = {
  seedDemoQuestionBank,
};
