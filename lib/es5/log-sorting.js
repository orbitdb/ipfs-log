'use strict';

var Clock = require('./lamport-clock');

/**
 * Sort two entries as Last-Write-Wins (LWW)
 * @description  Last Write Wins is a conflict resolution strategy for sorting elements
 *               where the element with a greater clock (latest) is chosen as the winner
 * @param {Entry} [a] First entry
 * @param {Entry} [b] Second entry
 * @returns {int} 1 if a is latest, -1 if b is latest
 */
function LastWriteWins(a, b) {
  // Ultimate conflict resolution (take the first/left arg)
  var First = function First(a, b) {
    return a;
  };
  // Sort two entries by their clock id, if the same always take the first
  var sortById = function sortById(a, b) {
    return SortByClockId(a, b, First);
  };
  // Sort two entries by their clock time, if concurrent,
  // determine sorting using provided conflict resolution function
  var sortByEntryClocks = function sortByEntryClocks(a, b) {
    return SortByClocks(a, b, sortById);
  };
  // Sort entries by clock time as the primary sort criteria
  return sortByEntryClocks(a, b);
}

/**
 * Sort two entries by their clock time
 * @param {Entry} [a] First entry to compare
 * @param {Entry} [b] Second entry to compare
 * @param {function(a, b)} [resolveConflict] A function to call if entries are concurrent (happened at the same time). The function should take in two entries and return 1 if the first entry should be chosen and -1 if the second entry should be chosen.
 * @returns {int} 1 if a is greater, -1 if b is greater
 */
function SortByClocks(a, b, resolveConflict) {
  // Compare the clocks
  var diff = Clock.compare(a.clock, b.clock);
  // If the clocks are concurrent, use the provided
  // conflict resolution function to determine which comes first
  return diff === 0 ? resolveConflict(a, b) : diff;
}

/**
 * Sort two entries by their clock id
 * @param {Entry} [a] First entry to compare
 * @param {Entry} [b] Second entry to compare
 * @param {function(a, b)} [resolveConflict] A function to call if the clocks ids are the same. The function should take in two entries and return 1 if the first entry should be chosen and -1 if the second entry should be chosen.
 * @returns {int} 1 if a is greater, -1 if b is greater
 */
function SortByClockId(a, b, resolveConflict) {
  // Sort by ID if clocks are concurrent,
  // take the entry with a "greater" clock id
  return a.clock.id === b.clock.id ? resolveConflict(a, b) : a.clock.id < b.clock.id ? -1 : 1;
}

exports.SortByClocks = SortByClocks;
exports.SortByClockId = SortByClockId;
exports.LastWriteWins = LastWriteWins;