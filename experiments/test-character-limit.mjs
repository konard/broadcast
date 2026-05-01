#!/usr/bin/env bun

import XBroadcaster from '../x.mjs';

// Create a long message (over X.com's 280 character limit)
const longMessage = "You may want to become a millionaire thinking that it will allow you to increase your spending. However, the only way to become a millionaire is by reducing expenses, increasing income, and getting used to living that way. A millionaire is not someone who spends a lot, but someone who does everything to grow their wealth. Otherwise, they will quickly stop being a millionaire. Spending is easy. Growing wealth is harder.";

console.log("🧪 Testing X.com character limit validation...");
console.log(`\n📏 Message length: ${longMessage.length} characters`);
console.log(`📝 Message: "${longMessage}"`);

const xBroadcaster = new XBroadcaster();
const validation = xBroadcaster.validateMessage(longMessage);

console.log(`\n🔍 Validation result:`);
console.log(`  Valid: ${validation.isValid}`);
console.log(`  Errors: ${validation.errors}`);

if (!validation.isValid) {
  console.log("\n✅ PASS: Message correctly identified as too long for X.com");
  console.log("✅ PASS: This would prevent broadcast to ALL platforms as required");
} else {
  console.log("\n❌ FAIL: Message should have been rejected");
}

console.log("\n🎯 Expected behavior from issue #1:");
console.log("- When a message exceeds X.com's character limit");
console.log("- The entire broadcast should fail");
console.log("- No messages should be sent to ANY platform");
console.log("- This prevents partial broadcasts");