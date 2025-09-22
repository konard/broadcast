#!/usr/bin/env bun

import XBroadcaster from '../x.mjs';
import TelegramBroadcaster from '../telegram.mjs';
import VKBroadcaster from '../vk.mjs';

// Create broadcaster instances
const xBroadcaster = new XBroadcaster();
const telegramBroadcaster = new TelegramBroadcaster();
const vkBroadcaster = new VKBroadcaster();

// Test messages
const shortMessage = "This is a short message";
const longMessage = "a".repeat(300); // 300 characters, should fail X limit

console.log("🧪 Testing message validation...\n");

console.log("📏 Test message lengths:");
console.log(`Short message: ${shortMessage.length} characters`);
console.log(`Long message: ${longMessage.length} characters\n`);

console.log("🔍 Testing X.com validation:");
console.log("Short message:", xBroadcaster.validateMessage(shortMessage));
console.log("Long message:", xBroadcaster.validateMessage(longMessage));

console.log("\n🔍 Testing Telegram validation:");
console.log("Short message:", telegramBroadcaster.validateMessage(shortMessage));
console.log("Long message:", telegramBroadcaster.validateMessage(longMessage));

console.log("\n🔍 Testing VK validation:");
console.log("Short message:", vkBroadcaster.validateMessage(shortMessage));
console.log("Long message:", vkBroadcaster.validateMessage(longMessage));

console.log("\n✅ Validation test completed");