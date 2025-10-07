// ============================================
// src/utils/seed.js - Database Seeding Script
// ============================================
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Category = require("../models/Category");
const Addon = require("../models/Addon");
const MenuItem = require("../models/MenuItem");
const RestaurantSettings = require("../models/RestaurantSettings");
const logger = require("./logger");

const connectDB = require("../config/database");

// Sample data
const sampleUsers = [
  {
    fullName: "Owner Admin",
    username: "owner",
    pin: "1234", // Will be hashed automatically
    role: "owner",
  },
  {
    fullName: "Rahel Tadesse",
    username: "rahel",
    pin: "1111",
    role: "waitress",
  },
  {
    fullName: "Marta Bekele",
    username: "marta",
    pin: "2222",
    role: "waitress",
  },
  {
    fullName: "Chef Alemayehu",
    username: "chef",
    pin: "3333",
    role: "kitchen",
  },
  {
    fullName: "Juice Bar Staff",
    username: "juice",
    pin: "4444",
    role: "juicebar",
  },
];

const sampleCategories = [
  {
    name: { en: "Main Dishes", am: "ዋና ምግቦች" },
    prepStation: "kitchen",
    requiresPreparation: true,
    autoDeductStock: false,
  },
  {
    name: { en: "Breakfast", am: "ቁርስ" },
    prepStation: "kitchen",
    requiresPreparation: true,
    autoDeductStock: false,
  },
  {
    name: { en: "Fresh Juices", am: "ትኩስ ጁስ" },
    prepStation: "juicebar",
    requiresPreparation: true,
    autoDeductStock: false,
  },
  {
    name: { en: "Soft Drinks", am: "ለስላሳ መጠጦች" },
    prepStation: "none",
    requiresPreparation: false,
    autoDeductStock: true,
  },
  {
    name: { en: "Water", am: "ውሃ" },
    prepStation: "none",
    requiresPreparation: false,
    autoDeductStock: true,
  },
];

const sampleAddons = [
  {
    name: { en: "Extra Cheese", am: "ተጨማሪ አይብ" },
    price: 0.5,
    isOptional: true,
  },
  {
    name: { en: "Extra Spicy", am: "ተጨማሪ ቅመም" },
    price: 0,
    isOptional: true,
  },
  {
    name: { en: "No Onion", am: "ሽንኩርት የለም" },
    price: 0,
    isOptional: true,
  },
  {
    name: { en: "Extra Sauce", am: "ተጨማሪ ሾርባ" },
    price: 0.25,
    isOptional: true,
  },
];

const seedDatabase = async () => {
  try {
    // Connect to database
    await connectDB();

    // Clear existing data
    logger.info("🗑️  Clearing existing data...");
    await User.deleteMany({});
    await Category.deleteMany({});
    await Addon.deleteMany({});
    await MenuItem.deleteMany({});
    await RestaurantSettings.deleteMany({});

    // Create owner user first
    logger.info("👤 Creating users...");
    const owner = await User.create(sampleUsers[0]);

    // Create other users with owner as creator
    const otherUsers = await Promise.all(
      sampleUsers
        .slice(1)
        .map((user) => User.create({ ...user, createdBy: owner._id }))
    );

    logger.info(`✅ Created ${sampleUsers.length} users`);

    // Create categories
    logger.info("📁 Creating categories...");
    const categories = await Promise.all(
      sampleCategories.map((category) =>
        Category.create({ ...category, createdBy: owner._id })
      )
    );
    logger.info(`✅ Created ${categories.length} categories`);

    // Create addons
    logger.info("🔧 Creating add-ons...");
    const addons = await Promise.all(
      sampleAddons.map((addon) =>
        Addon.create({ ...addon, createdBy: owner._id })
      )
    );
    logger.info(`✅ Created ${addons.length} add-ons`);

    // Create sample menu items
    logger.info("🍽️  Creating menu items...");
    const mainDishCategory = categories.find(
      (c) => c.name.en === "Main Dishes"
    );
    const breakfastCategory = categories.find((c) => c.name.en === "Breakfast");
    const juiceCategory = categories.find((c) => c.name.en === "Fresh Juices");
    const softDrinkCategory = categories.find(
      (c) => c.name.en === "Soft Drinks"
    );
    const waterCategory = categories.find((c) => c.name.en === "Water");

    const sampleMenuItems = [
      {
        name: { en: "Doro Wot", am: "ዶሮ ወጥ" },
        description: { en: "Spicy chicken stew", am: "ቅመማማ የዶሮ ወጥ" },
        pricing: {
          dineIn: 12.99,
          takeaway: 12.99,
          hasDifferentTakeawayPrice: false,
        },
        categoryId: mainDishCategory._id,
        prepStation: "kitchen",
        requiresPreparation: true,
        addOns: [addons[1]._id, addons[2]._id],
        available: true,
        createdBy: owner._id,
      },
      {
        name: { en: "Kitfo", am: "ክትፎ" },
        description: { en: "Minced raw beef", am: "የተፈጨ ሥጋ" },
        pricing: {
          dineIn: 14.99,
          takeaway: 14.99,
          hasDifferentTakeawayPrice: false,
        },
        categoryId: mainDishCategory._id,
        prepStation: "kitchen",
        requiresPreparation: true,
        addOns: [addons[1]._id, addons[3]._id],
        available: true,
        createdBy: owner._id,
      },
      {
        name: { en: "Firfir", am: "ፍርፍር" },
        description: {
          en: "Shredded injera with sauce",
          am: "የተቆረጠ እንጀራ በሾርባ",
        },
        pricing: {
          dineIn: 8.99,
          takeaway: 8.99,
          hasDifferentTakeawayPrice: false,
        },
        categoryId: breakfastCategory._id,
        prepStation: "kitchen",
        requiresPreparation: true,
        available: true,
        createdBy: owner._id,
      },
      {
        name: { en: "Orange Juice", am: "የብርቱካን ጁስ" },
        description: { en: "Fresh orange juice", am: "ትኩስ የብርቱካን ጁስ" },
        pricing: {
          dineIn: 3.5,
          takeaway: 3.5,
          hasDifferentTakeawayPrice: false,
        },
        categoryId: juiceCategory._id,
        prepStation: "juicebar",
        requiresPreparation: true,
        available: true,
        createdBy: owner._id,
      },
      {
        name: { en: "Coca Cola", am: "ኮካ ኮላ" },
        description: { en: "Chilled soft drink", am: "ቀዝቃዛ ለስላሳ መጠጥ" },
        pricing: {
          dineIn: 1.5,
          takeaway: 1.5,
          hasDifferentTakeawayPrice: false,
        },
        categoryId: softDrinkCategory._id,
        prepStation: "none",
        requiresPreparation: false,
        stockTracking: {
          enabled: true,
          currentStock: 50,
          minStock: 10,
          unit: "bottles",
          deductOnOrder: true,
        },
        available: true,
        createdBy: owner._id,
      },
      {
        name: { en: "Bottled Water", am: "ታሸገ ውሃ" },
        description: { en: "Mineral water", am: "ማዕድን ውሃ" },
        pricing: {
          dineIn: 1.0,
          takeaway: 1.0,
          hasDifferentTakeawayPrice: false,
        },
        categoryId: waterCategory._id,
        prepStation: "none",
        requiresPreparation: false,
        stockTracking: {
          enabled: true,
          currentStock: 100,
          minStock: 20,
          unit: "bottles",
          deductOnOrder: true,
        },
        available: true,
        createdBy: owner._id,
      },
    ];

    await MenuItem.insertMany(sampleMenuItems);
    logger.info(`✅ Created ${sampleMenuItems.length} menu items`);

    // Create default settings
    logger.info("⚙️  Creating default settings...");
    await RestaurantSettings.create({
      language: "am", // Default to Amharic
      theme: "light",
      graceWindowMinutes: 3,
      takeawayPricing: {
        policy: "same-as-dinein",
        discountPercentage: 0,
      },
      updatedBy: owner._id,
    });
    logger.info("✅ Created default settings");

    logger.info("\n✨ Database seeded successfully!\n");
    logger.info("📝 Default Login Credentials:");
    logger.info('   Owner: username="owner", PIN="1234"');
    logger.info('   Waitress: username="rahel", PIN="1111"');
    logger.info('   Waitress: username="marta", PIN="2222"');
    logger.info('   Kitchen: username="chef", PIN="3333"');
    logger.info('   Juice Bar: username="juice", PIN="4444"\n');

    process.exit(0);
  } catch (error) {
    logger.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

// Run seed
seedDatabase();
