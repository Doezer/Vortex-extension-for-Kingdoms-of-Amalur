'use strict';

// The original Reckoning uses Steam 102500. Never match it by a loose title search.
const STORE_IDS = [
  ['steam', '1041720'],
  ['gog', '1077045575'],
  ['epic', 'b8aa8afb7da84da3a978425ec4b8e5cd'],
];

async function findGame(helper) {
  let lastError;
  for (const [store, id] of STORE_IDS) {
    try {
      const entry = await helper.findByAppId(id, store);
      if (entry && entry.gamePath) return entry.gamePath;
    } catch (error) {
      // Store misses are expected. Preserve permission / I/O errors for diagnosis.
      if (!['GameEntryNotFound', 'ProcessCanceled'].includes(error.name)) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error('Re-Reckoning was not discovered. Select the folder containing koa.exe manually.');
}

module.exports = { findGame, STORE_IDS };
