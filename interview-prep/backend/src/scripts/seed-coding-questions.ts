import mongoose from 'mongoose';
import config from '../config';
import { CodingProblem } from '../modules/coding/coding-problem.model';

/** Minimal statement built from the curated metadata when none was supplied. */
const PATTERN_ENUM = ['arrays', 'strings', 'linked_lists', 'trees', 'graphs', 'dynamic_programming',
  'backtracking', 'sorting', 'searching', 'greedy', 'intervals', 'math', 'geometry', 'bit_manipulation',
  'tries', 'heap', 'stack', 'queue', 'two_pointers', 'sliding_window', 'binary_search', 'union_find',
  'segment_tree', 'prefix_sum', 'monotonic_stack', 'topological_sort', 'shortest_path',
  'minimum_spanning_tree', 'flow', 'dp_on_graphs'];

function problemStatement(p: { title: string; difficulty: string; pattern: string[]; tags: string[] }): string {
  const patterns = (p.pattern || []).join(', ') || 'an efficient';
  const tags = (p.tags || []).slice(0, 4).join(', ');
  return `Solve "${p.title}" (${p.difficulty} difficulty). Describe the algorithm you would implement, `
    + `its time and space complexity, and the edge cases it must handle. Aim for an ${patterns} approach.`
    + (tags ? ` Related concepts: ${tags}.` : '')
    + ' Give a complete, self-contained answer: no partial snippets and no external references.';
}

// Parse the question patterns and generate coding problems
const questionPatterns = {
  two_pointer: {
    title: 'Two Pointer Patterns',
    problems: [
      // Converging
      { title: 'Squares of a Sorted Array', slug: 'squares-of-a-sorted-array', difficulty: 'easy', pattern: ['two_pointers', 'arrays'], platform: 'leetcode', problemId: '977', url: 'https://leetcode.com/problems/squares-of-a-sorted-array/', frequency: 'common', tags: ['two pointers', 'array', 'sorting'] },
      { title: '3Sum', slug: '3sum', difficulty: 'medium', pattern: ['two_pointers', 'arrays', 'sorting'], platform: 'leetcode', problemId: '15', url: 'https://leetcode.com/problems/3sum/', frequency: 'frequent', tags: ['two pointers', 'array', 'sorting'] },
      { title: 'Container With Most Water', slug: 'container-with-most-water', difficulty: 'medium', pattern: ['two_pointers', 'arrays', 'greedy'], platform: 'leetcode', problemId: '11', url: 'https://leetcode.com/problems/container-with-most-water/', frequency: 'frequent', tags: ['two pointers', 'greedy', 'array'] },
      { title: 'Two Sum II - Input Array Is Sorted', slug: 'two-sum-ii-input-array-is-sorted', difficulty: 'medium', pattern: ['two_pointers', 'arrays', 'binary_search'], platform: 'leetcode', problemId: '167', url: 'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/', frequency: 'common', tags: ['two pointers', 'binary search', 'array'] },
      { title: '4Sum', slug: '4sum', difficulty: 'medium', pattern: ['two_pointers', 'arrays', 'sorting'], platform: 'leetcode', problemId: '18', url: 'https://leetcode.com/problems/4sum/', frequency: 'medium', tags: ['two pointers', 'array', 'sorting'] },
      { title: '3Sum Closest', slug: '3sum-closest', difficulty: 'medium', pattern: ['two_pointers', 'arrays', 'sorting'], platform: 'leetcode', problemId: '16', url: 'https://leetcode.com/problems/3sum-closest/', frequency: 'medium', tags: ['two pointers', 'array', 'sorting'] },
      { title: 'Boats to Save People', slug: 'boats-to-save-people', difficulty: 'medium', pattern: ['two_pointers', 'greedy', 'arrays'], platform: 'leetcode', problemId: '881', url: 'https://leetcode.com/problems/boats-to-save-people/', frequency: 'medium', tags: ['two pointers', 'greedy', 'array'] },
      { title: '3Sum Smaller', slug: '3sum-smaller', difficulty: 'medium', pattern: ['two_pointers', 'arrays', 'sorting'], platform: 'leetcode', problemId: '259', url: 'https://leetcode.com/problems/3sum-smaller/', frequency: 'rare', tags: ['two pointers', 'array'] },
      // String Reversal
      { title: 'Reverse String', slug: 'reverse-string', difficulty: 'easy', pattern: ['two_pointers', 'strings'], platform: 'leetcode', problemId: '344', url: 'https://leetcode.com/problems/reverse-string/', frequency: 'common', tags: ['two pointers', 'string'] },
      { title: 'Reverse String II', slug: 'reverse-string-ii', difficulty: 'easy', pattern: ['two_pointers', 'strings'], platform: 'leetcode', problemId: '541', url: 'https://leetcode.com/problems/reverse-string-ii/', frequency: 'common', tags: ['two pointers', 'string'] },
      { title: 'Reverse Vowels of a String', slug: 'reverse-vowels-of-a-string', difficulty: 'easy', pattern: ['two_pointers', 'strings'], platform: 'leetcode', problemId: '345', url: 'https://leetcode.com/problems/reverse-vowels-of-a-string/', frequency: 'common', tags: ['two pointers', 'string'] },
      { title: 'Reverse Words in a String', slug: 'reverse-words-in-a-string', difficulty: 'medium', pattern: ['two_pointers', 'strings'], platform: 'leetcode', problemId: '151', url: 'https://leetcode.com/problems/reverse-words-in-a-string/', frequency: 'common', tags: ['two pointers', 'string'] },
      // In-place Array Modification
      { title: 'Remove Element', slug: 'remove-element', difficulty: 'easy', pattern: ['two_pointers', 'arrays'], platform: 'leetcode', problemId: '27', url: 'https://leetcode.com/problems/remove-element/', frequency: 'common', tags: ['two pointers', 'array'] },
      { title: 'Remove Duplicates from Sorted Array', slug: 'remove-duplicates-from-sorted-array', difficulty: 'easy', pattern: ['two_pointers', 'arrays'], platform: 'leetcode', problemId: '26', url: 'https://leetcode.com/problems/remove-duplicates-from-sorted-array/', frequency: 'common', tags: ['two pointers', 'array'] },
      { title: 'Move Zeroes', slug: 'move-zeroes', difficulty: 'easy', pattern: ['two_pointers', 'arrays'], platform: 'leetcode', problemId: '283', url: 'https://leetcode.com/problems/move-zeroes/', frequency: 'common', tags: ['two pointers', 'array'] },
      { title: 'Sort Array By Parity', slug: 'sort-array-by-parity', difficulty: 'easy', pattern: ['two_pointers', 'arrays'], platform: 'leetcode', problemId: '905', url: 'https://leetcode.com/problems/sort-array-by-parity/', frequency: 'common', tags: ['two pointers', 'array'] },
      { title: 'Intersection of Two Arrays', slug: 'intersection-of-two-arrays', difficulty: 'easy', pattern: ['two_pointers', 'arrays', 'hashing'], platform: 'leetcode', problemId: '349', url: 'https://leetcode.com/problems/intersection-of-two-arrays/', frequency: 'common', tags: ['two pointers', 'array', 'hash table'] },
      { title: 'Separate Black and White Balls', slug: 'separate-black-and-white-balls', difficulty: 'medium', pattern: ['two_pointers', 'arrays', 'greedy'], platform: 'leetcode', problemId: '2938', url: 'https://leetcode.com/problems/separate-black-and-white-balls/', frequency: 'rare', tags: ['two pointers', 'greedy'] },
      { title: 'Remove Duplicates from Sorted Array II', slug: 'remove-duplicates-from-sorted-array-ii', difficulty: 'medium', pattern: ['two_pointers', 'arrays'], platform: 'leetcode', problemId: '80', url: 'https://leetcode.com/problems/remove-duplicates-from-sorted-array-ii/', frequency: 'medium', tags: ['two pointers', 'array'] },
      { title: 'Move Pieces to Obtain a String', slug: 'move-pieces-to-obtain-a-string', difficulty: 'medium', pattern: ['two_pointers', 'strings'], platform: 'leetcode', problemId: '2337', url: 'https://leetcode.com/problems/move-pieces-to-obtain-a-string/', frequency: 'rare', tags: ['two pointers', 'string'] },
      { title: 'Sort Colors', slug: 'sort-colors', difficulty: 'medium', pattern: ['two_pointers', 'arrays', 'sorting'], platform: 'leetcode', problemId: '75', url: 'https://leetcode.com/problems/sort-colors/', frequency: 'common', tags: ['two pointers', 'array', 'sorting'] },
      { title: 'String Compression', slug: 'string-compression', difficulty: 'medium', pattern: ['two_pointers', 'strings'], platform: 'leetcode', problemId: '443', url: 'https://leetcode.com/problems/string-compression/', frequency: 'medium', tags: ['two pointers', 'string'] },
      // Fast and Slow
      { title: 'Happy Number', slug: 'happy-number', difficulty: 'easy', pattern: ['two_pointers', 'math'], platform: 'leetcode', problemId: '202', url: 'https://leetcode.com/problems/happy-number/', frequency: 'common', tags: ['two pointers', 'math'] },
      { title: 'Linked List Cycle', slug: 'linked-list-cycle', difficulty: 'easy', pattern: ['two_pointers', 'linked_lists'], platform: 'leetcode', problemId: '141', url: 'https://leetcode.com/problems/linked-list-cycle/', frequency: 'common', tags: ['two pointers', 'linked list', 'fast slow pointer'] },
      { title: 'Is Subsequence', slug: 'is-subsequence', difficulty: 'easy', pattern: ['two_pointers', 'strings', 'dynamic_programming'], platform: 'leetcode', problemId: '392', url: 'https://leetcode.com/problems/is-subsequence/', frequency: 'common', tags: ['two pointers', 'string', 'dynamic programming'] },
      { title: 'Find the Duplicate Number', slug: 'find-the-duplicate-number', difficulty: 'medium', pattern: ['two_pointers', 'arrays', 'binary_search'], platform: 'leetcode', problemId: '287', url: 'https://leetcode.com/problems/find-the-duplicate-number/', frequency: 'common', tags: ['two pointers', 'array', 'binary search', 'fast slow pointer'] },
      // Fixed Separation
      { title: 'Middle of the Linked List', slug: 'middle-of-the-linked-list', difficulty: 'easy', pattern: ['two_pointers', 'linked_lists'], platform: 'leetcode', problemId: '876', url: 'https://leetcode.com/problems/middle-of-the-linked-list/', frequency: 'common', tags: ['two pointers', 'linked list'] },
      { title: 'Remove Nth Node From End of List', slug: 'remove-nth-node-from-end-of-list', difficulty: 'medium', pattern: ['two_pointers', 'linked_lists'], platform: 'leetcode', problemId: '19', url: 'https://leetcode.com/problems/remove-nth-node-from-end-of-list/', frequency: 'common', tags: ['two pointers', 'linked list'] },
      { title: 'Delete the Middle Node of a Linked List', slug: 'delete-the-middle-node-of-a-linked-list', difficulty: 'medium', pattern: ['two_pointers', 'linked_lists'], platform: 'leetcode', problemId: '2095', url: 'https://leetcode.com/problems/delete-the-middle-node-of-a-linked-list/', frequency: 'medium', tags: ['two pointers', 'linked list'] },
      // String Comparison with Special Characters
      { title: 'Backspace String Compare', slug: 'backspace-string-compare', difficulty: 'easy', pattern: ['two_pointers', 'strings', 'stacks'], platform: 'leetcode', problemId: '844', url: 'https://leetcode.com/problems/backspace-string-compare/', frequency: 'common', tags: ['two pointers', 'string', 'stack'] },
      { title: 'Crawler Log Folder', slug: 'crawler-log-folder', difficulty: 'easy', pattern: ['two_pointers', 'strings'], platform: 'leetcode', problemId: '1598', url: 'https://leetcode.com/problems/crawler-log-folder/', frequency: 'common', tags: ['two pointers', 'string'] },
      { title: 'Removing Stars From a String', slug: 'removing-stars-from-a-string', difficulty: 'medium', pattern: ['two_pointers', 'strings', 'stacks'], platform: 'leetcode', problemId: '2390', url: 'https://leetcode.com/problems/removing-stars-from-a-string/', frequency: 'medium', tags: ['two pointers', 'string', 'stack'] },
      // Expanding From Center
      { title: 'Palindromic Substrings', slug: 'palindromic-substrings', difficulty: 'medium', pattern: ['two_pointers', 'strings', 'dynamic_programming'], platform: 'leetcode', problemId: '647', url: 'https://leetcode.com/problems/palindromic-substrings/', frequency: 'common', tags: ['two pointers', 'string', 'dynamic programming'] },
      { title: 'Longest Palindromic Substring', slug: 'longest-palindromic-substring', difficulty: 'medium', pattern: ['two_pointers', 'strings', 'dynamic_programming'], platform: 'leetcode', problemId: '5', url: 'https://leetcode.com/problems/longest-palindromic-substring/', frequency: 'frequent', tags: ['two pointers', 'string', 'dynamic programming'] },
    ],
  },
  array_matrix: {
    title: 'Array/Matrix Manipulation Patterns',
    problems: [
      { title: 'Add Binary', slug: 'add-binary', difficulty: 'easy', pattern: ['arrays', 'strings', 'math'], platform: 'leetcode', problemId: '67', url: 'https://leetcode.com/problems/add-binary/', frequency: 'common', tags: ['array', 'string', 'math'] },
      { title: 'Plus One', slug: 'plus-one', difficulty: 'easy', pattern: ['arrays', 'math'], platform: 'leetcode', problemId: '66', url: 'https://leetcode.com/problems/plus-one/', frequency: 'common', tags: ['array', 'math'] },
      { title: 'Add to Array-Form of Integer', slug: 'add-to-array-form-of-integer', difficulty: 'easy', pattern: ['arrays', 'math'], platform: 'leetcode', problemId: '989', url: 'https://leetcode.com/problems/add-to-array-form-of-integer/', frequency: 'medium', tags: ['array', 'math'] },
      { title: 'Multiply Strings', slug: 'multiply-strings', difficulty: 'medium', pattern: ['arrays', 'strings', 'math'], platform: 'leetcode', problemId: '43', url: 'https://leetcode.com/problems/multiply-strings/', frequency: 'medium', tags: ['array', 'string', 'math'] },
      { title: 'Squares of a Sorted Array', slug: 'squares-of-a-sorted-array-2', difficulty: 'easy', pattern: ['arrays', 'two_pointers', 'sorting'], platform: 'leetcode', problemId: '977', url: 'https://leetcode.com/problems/squares-of-a-sorted-array/', frequency: 'common', tags: ['array', 'two pointers', 'sorting'] },
      { title: 'Merge Sorted Array', slug: 'merge-sorted-array', difficulty: 'easy', pattern: ['arrays', 'two_pointers', 'sorting'], platform: 'leetcode', problemId: '88', url: 'https://leetcode.com/problems/merge-sorted-array/', frequency: 'common', tags: ['array', 'two pointers', 'sorting'] },
      { title: 'Transpose Matrix', slug: 'transpose-matrix', difficulty: 'easy', pattern: ['arrays', 'matrix'], platform: 'leetcode', problemId: '867', url: 'https://leetcode.com/problems/transpose-matrix/', frequency: 'common', tags: ['array', 'matrix'] },
      { title: 'Rotate Array', slug: 'rotate-array', difficulty: 'medium', pattern: ['arrays'], platform: 'leetcode', problemId: '189', url: 'https://leetcode.com/problems/rotate-array/', frequency: 'common', tags: ['array'] },
      { title: 'Rotate Image', slug: 'rotate-image', difficulty: 'medium', pattern: ['arrays', 'matrix'], platform: 'leetcode', problemId: '48', url: 'https://leetcode.com/problems/rotate-image/', frequency: 'common', tags: ['array', 'matrix'] },
      { title: 'Spiral Matrix', slug: 'spiral-matrix', difficulty: 'medium', pattern: ['arrays', 'matrix'], platform: 'leetcode', problemId: '54', url: 'https://leetcode.com/problems/spiral-matrix/', frequency: 'common', tags: ['array', 'matrix'] },
      { title: 'Spiral Matrix IV', slug: 'spiral-matrix-iv', difficulty: 'medium', pattern: ['arrays', 'matrix', 'linked_lists'], platform: 'leetcode', problemId: '2326', url: 'https://leetcode.com/problems/spiral-matrix-iv/', frequency: 'rare', tags: ['array', 'matrix', 'linked list'] },
      { title: 'Spiral Matrix II', slug: 'spiral-matrix-ii', difficulty: 'medium', pattern: ['arrays', 'matrix'], platform: 'leetcode', problemId: '59', url: 'https://leetcode.com/problems/spiral-matrix-ii/', frequency: 'common', tags: ['array', 'matrix'] },
      { title: 'Spiral Matrix III', slug: 'spiral-matrix-iii', difficulty: 'medium', pattern: ['arrays', 'matrix'], platform: 'leetcode', problemId: '885', url: 'https://leetcode.com/problems/spiral-matrix-iii/', frequency: 'rare', tags: ['array', 'matrix'] },
      { title: 'Set Matrix Zeroes', slug: 'set-matrix-zeroes', difficulty: 'medium', pattern: ['arrays', 'matrix'], platform: 'leetcode', problemId: '73', url: 'https://leetcode.com/problems/set-matrix-zeroes/', frequency: 'common', tags: ['array', 'matrix'] },
      { title: 'Game of Life', slug: 'game-of-life', difficulty: 'medium', pattern: ['arrays', 'matrix'], platform: 'leetcode', problemId: '289', url: 'https://leetcode.com/problems/game-of-life/', frequency: 'medium', tags: ['array', 'matrix'] },
      { title: 'Diagonal Traverse', slug: 'diagonal-traverse', difficulty: 'medium', pattern: ['arrays', 'matrix'], platform: 'leetcode', problemId: '498', url: 'https://leetcode.com/problems/diagonal-traverse/', frequency: 'medium', tags: ['array', 'matrix'] },
      { title: 'Product of Array Except Self', slug: 'product-of-array-except-self', difficulty: 'medium', pattern: ['arrays', 'prefix_sum'], platform: 'leetcode', problemId: '238', url: 'https://leetcode.com/problems/product-of-array-except-self/', frequency: 'frequent', tags: ['array', 'prefix sum'] },
      { title: 'Longest Mountain in Array', slug: 'longest-mountain-in-array', difficulty: 'medium', pattern: ['arrays'], platform: 'leetcode', problemId: '845', url: 'https://leetcode.com/problems/longest-mountain-in-array/', frequency: 'medium', tags: ['array'] },
      { title: 'Two Sum', slug: 'two-sum', difficulty: 'easy', pattern: ['arrays', 'hashing'], platform: 'leetcode', problemId: '1', url: 'https://leetcode.com/problems/two-sum/', frequency: 'frequent', tags: ['array', 'hash table'] },
      { title: 'Valid Anagram', slug: 'valid-anagram', difficulty: 'easy', pattern: ['hashing', 'strings'], platform: 'leetcode', problemId: '242', url: 'https://leetcode.com/problems/valid-anagram/', frequency: 'frequent', tags: ['hash table', 'string', 'sorting'] },
      { title: 'Group Anagrams', slug: 'group-anagrams', difficulty: 'medium', pattern: ['hashing', 'strings', 'sorting'], platform: 'leetcode', problemId: '49', url: 'https://leetcode.com/problems/group-anagrams/', frequency: 'frequent', tags: ['hash table', 'string', 'sorting'] },
      { title: 'Top K Frequent Elements', slug: 'top-k-frequent-elements', difficulty: 'medium', pattern: ['hashing', 'arrays', 'heap'], platform: 'leetcode', problemId: '347', url: 'https://leetcode.com/problems/top-k-frequent-elements/', frequency: 'frequent', tags: ['hash table', 'array', 'heap'] },
      { title: 'Sort Characters By Frequency', slug: 'sort-characters-by-frequency', difficulty: 'medium', pattern: ['hashing', 'strings', 'sorting'], platform: 'leetcode', problemId: '451', url: 'https://leetcode.com/problems/sort-characters-by-frequency/', frequency: 'medium', tags: ['hash table', 'string', 'sorting'] },
      { title: 'Task Scheduler', slug: 'task-scheduler', difficulty: 'medium', pattern: ['hashing', 'greedy', 'heap'], platform: 'leetcode', problemId: '621', url: 'https://leetcode.com/problems/task-scheduler/', frequency: 'common', tags: ['hash table', 'greedy', 'heap'] },
      { title: 'Happy Number', slug: 'happy-number-2', difficulty: 'easy', pattern: ['hashing', 'math'], platform: 'leetcode', problemId: '202', url: 'https://leetcode.com/problems/happy-number/', frequency: 'common', tags: ['hash table', 'math'] },
      { title: 'Intersection of Two Arrays', slug: 'intersection-of-two-arrays-2', difficulty: 'easy', pattern: ['hashing', 'arrays'], platform: 'leetcode', problemId: '349', url: 'https://leetcode.com/problems/intersection-of-two-arrays/', frequency: 'common', tags: ['hash table', 'array'] },
      { title: 'Contains Duplicate II', slug: 'contains-duplicate-ii', difficulty: 'easy', pattern: ['hashing', 'arrays'], platform: 'leetcode', problemId: '219', url: 'https://leetcode.com/problems/contains-duplicate-ii/', frequency: 'medium', tags: ['hash table', 'array'] },
      { title: 'Longest Substring Without Repeating Characters', slug: 'longest-substring-without-repeating-characters-2', difficulty: 'medium', pattern: ['hashing', 'strings', 'sliding_window'], platform: 'leetcode', problemId: '3', url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/', frequency: 'frequent', tags: ['hash table', 'string', 'sliding window'] },
      { title: 'Find the Duplicate Number', slug: 'find-the-duplicate-number-2', difficulty: 'medium', pattern: ['hashing', 'arrays', 'binary_search'], platform: 'leetcode', problemId: '287', url: 'https://leetcode.com/problems/find-the-duplicate-number/', frequency: 'common', tags: ['hash table', 'array', 'binary search'] },
      { title: 'Product of Array Except Self', slug: 'product-of-array-except-self-2', difficulty: 'medium', pattern: ['prefix_sum', 'arrays'], platform: 'leetcode', problemId: '238', url: 'https://leetcode.com/problems/product-of-array-except-self/', frequency: 'frequent', tags: ['prefix sum', 'array'] },
      { title: 'Minimum Size Subarray Sum', slug: 'minimum-size-subarray-sum', difficulty: 'medium', pattern: ['prefix_sum', 'arrays', 'binary_search', 'two_pointers'], platform: 'leetcode', problemId: '209', url: 'https://leetcode.com/problems/minimum-size-subarray-sum/', frequency: 'medium', tags: ['prefix sum', 'array', 'binary search', 'two pointers'] },
      { title: 'Max Consecutive Ones III', slug: 'max-consecutive-ones-iii', difficulty: 'medium', pattern: ['prefix_sum', 'arrays', 'sliding_window'], platform: 'leetcode', problemId: '1004', url: 'https://leetcode.com/problems/max-consecutive-ones-iii/', frequency: 'medium', tags: ['prefix sum', 'array', 'sliding window'] },
      { title: 'Frequency of the Most Frequent Element', slug: 'frequency-of-the-most-frequent-element', difficulty: 'medium', pattern: ['prefix_sum', 'arrays', 'sliding_window', 'sorting'], platform: 'leetcode', problemId: '2857', url: 'https://leetcode.com/problems/frequency-of-the-most-frequent-element/', frequency: 'medium', tags: ['prefix sum', 'array', 'sliding window', 'sorting'] },
      { title: 'Split Array Largest Sum', slug: 'split-array-largest-sum', difficulty: 'hard', pattern: ['prefix_sum', 'arrays', 'binary_search'], platform: 'leetcode', problemId: '410', url: 'https://leetcode.com/problems/split-array-largest-sum/', frequency: 'medium', tags: ['prefix sum', 'array', 'binary search', 'dynamic programming'] },
      { title: 'Missing Number', slug: 'missing-number', difficulty: 'easy', pattern: ['arrays', 'math', 'bit_manipulation'], platform: 'leetcode', problemId: '268', url: 'https://leetcode.com/problems/missing-number/', frequency: 'frequent', tags: ['array', 'math', 'bit manipulation'] },
      { title: 'Find All Numbers Disappeared in an Array', slug: 'find-all-numbers-disappeared-in-an-array', difficulty: 'easy', pattern: ['arrays'], platform: 'leetcode', problemId: '448', url: 'https://leetcode.com/problems/find-all-numbers-disappeared-in-an-array/', frequency: 'medium', tags: ['array'] },
      { title: 'Find the Duplicate Number', slug: 'find-the-duplicate-number-3', difficulty: 'medium', pattern: ['arrays', 'two_pointers', 'binary_search'], platform: 'leetcode', problemId: '287', url: 'https://leetcode.com/problems/find-the-duplicate-number/', frequency: 'common', tags: ['array', 'two pointers', 'binary search'] },
      { title: 'Find All Duplicates in an Array', slug: 'find-all-duplicates-in-an-array', difficulty: 'medium', pattern: ['arrays'], platform: 'leetcode', problemId: '442', url: 'https://leetcode.com/problems/find-all-duplicates-in-an-array/', frequency: 'medium', tags: ['array'] },
      { title: 'First Missing Positive', slug: 'first-missing-positive', difficulty: 'hard', pattern: ['arrays', 'sorting'], platform: 'leetcode', problemId: '41', url: 'https://leetcode.com/problems/first-missing-positive/', frequency: 'frequent', tags: ['array', 'sorting'] },
    ],
  },
  linked_list: {
    title: 'Linked List Manipulation Patterns',
    problems: [
      { title: 'Merge Two Sorted Lists', slug: 'merge-two-sorted-lists', difficulty: 'easy', pattern: ['linked_lists', 'sorting'], platform: 'leetcode', problemId: '21', url: 'https://leetcode.com/problems/merge-two-sorted-lists/', frequency: 'frequent', tags: ['linked list', 'sorting'] },
      { title: 'Merge k Sorted Lists', slug: 'merge-k-sorted-lists', difficulty: 'hard', pattern: ['linked_lists', 'heap', 'divide_and_conquer'], platform: 'leetcode', problemId: '23', url: 'https://leetcode.com/problems/merge-k-sorted-lists/', frequency: 'frequent', tags: ['linked list', 'heap', 'divide and conquer'] },
      { title: 'Palindrome Linked List', slug: 'palindrome-linked-list', difficulty: 'easy', pattern: ['linked_lists', 'two_pointers'], platform: 'leetcode', problemId: '234', url: 'https://leetcode.com/problems/palindrome-linked-list/', frequency: 'common', tags: ['linked list', 'two pointers'] },
      { title: 'Reverse a Linked List', slug: 'reverse-a-linked-list', difficulty: 'easy', pattern: ['linked_lists'], platform: 'leetcode', problemId: '206', url: 'https://leetcode.com/problems/reverse-linked-list/', frequency: 'frequent', tags: ['linked list'] },
      { title: 'Remove Duplicates from Sorted List', slug: 'remove-duplicates-from-sorted-list', difficulty: 'easy', pattern: ['linked_lists'], platform: 'leetcode', problemId: '83', url: 'https://leetcode.com/problems/remove-duplicates-from-sorted-list/', frequency: 'common', tags: ['linked list'] },
      { title: 'Reverse Linked List II', slug: 'reverse-linked-list-ii', difficulty: 'medium', pattern: ['linked_lists'], platform: 'leetcode', problemId: '92', url: 'https://leetcode.com/problems/reverse-linked-list-ii/', frequency: 'medium', tags: ['linked list'] },
      { title: 'Remove Duplicates from Sorted List II', slug: 'remove-duplicates-from-sorted-list-ii', difficulty: 'medium', pattern: ['linked_lists'], platform: 'leetcode', problemId: '82', url: 'https://leetcode.com/problems/remove-duplicates-from-sorted-list-ii/', frequency: 'medium', tags: ['linked list'] },
      { title: 'Reverse Nodes in k-Group', slug: 'reverse-nodes-in-k-group', difficulty: 'hard', pattern: ['linked_lists'], platform: 'leetcode', problemId: '25', url: 'https://leetcode.com/problems/reverse-nodes-in-k-group/', frequency: 'hard', tags: ['linked list'] },
      { title: 'Intersection of Two Linked Lists', slug: 'intersection-of-two-linked-lists', difficulty: 'easy', pattern: ['linked_lists', 'two_pointers', 'hashing'], platform: 'leetcode', problemId: '160', url: 'https://leetcode.com/problems/intersection-of-two-linked-lists/', frequency: 'common', tags: ['linked list', 'two pointers', 'hash table'] },
      { title: 'Minimum Index Sum of Two Lists', slug: 'minimum-index-sum-of-two-lists', difficulty: 'easy', pattern: ['linked_lists', 'hashing', 'strings'], platform: 'leetcode', problemId: '599', url: 'https://leetcode.com/problems/minimum-index-sum-of-two-lists/', frequency: 'rare', tags: ['linked list', 'hash table', 'string'] },
      { title: 'Plus One Linked List', slug: 'plus-one-linked-list', difficulty: 'medium', pattern: ['linked_lists', 'math'], platform: 'leetcode', problemId: '369', url: 'https://leetcode.com/problems/plus-one-linked-list/', frequency: 'rare', tags: ['linked list', 'math'] },
      { title: 'Add Two Numbers', slug: 'add-two-numbers', difficulty: 'medium', pattern: ['linked_lists', 'math'], platform: 'leetcode', problemId: '2', url: 'https://leetcode.com/problems/add-two-numbers/', frequency: 'frequent', tags: ['linked list', 'math'] },
      { title: 'Rotate List', slug: 'rotate-list', difficulty: 'medium', pattern: ['linked_lists', 'two_pointers'], platform: 'leetcode', problemId: '61', url: 'https://leetcode.com/problems/rotate-list/', frequency: 'medium', tags: ['linked list', 'two pointers'] },
      { title: 'Partition List', slug: 'partition-list', difficulty: 'medium', pattern: ['linked_lists', 'two_pointers'], platform: 'leetcode', problemId: '86', url: 'https://leetcode.com/problems/partition-list/', frequency: 'medium', tags: ['linked list', 'two pointers'] },
      { title: 'Swap Nodes in Pairs', slug: 'swap-nodes-in-pairs', difficulty: 'medium', pattern: ['linked_lists'], platform: 'leetcode', problemId: '24', url: 'https://leetcode.com/problems/swap-nodes-in-pairs/', frequency: 'common', tags: ['linked list'] },
      { title: 'Reorder List', slug: 'reorder-list', difficulty: 'medium', pattern: ['linked_lists', 'two_pointers'], platform: 'leetcode', problemId: '143', url: 'https://leetcode.com/problems/reorder-list/', frequency: 'common', tags: ['linked list', 'two pointers'] },
      { title: 'Odd Even Linked List', slug: 'odd-even-linked-list', difficulty: 'medium', pattern: ['linked_lists'], platform: 'leetcode', problemId: '328', url: 'https://leetcode.com/problems/odd-even-linked-list/', frequency: 'medium', tags: ['linked list'] },
    ],
  },
  tree_traversal: {
    title: 'Tree Traversal Patterns (DFS & BFS)',
    problems: [
      { title: 'Symmetric Tree', slug: 'symmetric-tree', difficulty: 'easy', pattern: ['trees', 'recursion', 'dfs'], platform: 'leetcode', problemId: '101', url: 'https://leetcode.com/problems/symmetric-tree/', frequency: 'common', tags: ['tree', 'depth-first search', 'recursion'] },
      { title: 'Binary Tree Paths', slug: 'binary-tree-paths', difficulty: 'easy', pattern: ['trees', 'recursion', 'dfs', 'strings'], platform: 'leetcode', problemId: '257', url: 'https://leetcode.com/problems/binary-tree-paths/', frequency: 'common', tags: ['tree', 'depth-first search', 'string'] },
      { title: 'Same Tree', slug: 'same-tree', difficulty: 'easy', pattern: ['trees', 'recursion', 'dfs'], platform: 'leetcode', problemId: '100', url: 'https://leetcode.com/problems/same-tree/', frequency: 'frequent', tags: ['tree', 'depth-first search', 'recursion'] },
      { title: 'Invert Binary Tree', slug: 'invert-binary-tree', difficulty: 'easy', pattern: ['trees', 'recursion', 'dfs'], platform: 'leetcode', problemId: '226', url: 'https://leetcode.com/problems/invert-binary-tree/', frequency: 'frequent', tags: ['tree', 'depth-first search', 'recursion'] },
      { title: 'Flatten Binary Tree to Linked List', slug: 'flatten-binary-tree-to-linked-list', difficulty: 'medium', pattern: ['trees', 'recursion', 'dfs'], platform: 'leetcode', problemId: '114', url: 'https://leetcode.com/problems/flatten-binary-tree-to-linked-list/', frequency: 'medium', tags: ['tree', 'depth-first search'] },
      { title: 'Smallest String Starting From Leaf', slug: 'smallest-string-starting-from-leaf', difficulty: 'medium', pattern: ['trees', 'recursion', 'dfs', 'strings'], platform: 'leetcode', problemId: '988', url: 'https://leetcode.com/problems/smallest-string-starting-from-leaf/', frequency: 'medium', tags: ['tree', 'depth-first search', 'string'] },
      { title: 'Construct Binary Tree from Preorder and Inorder Traversal', slug: 'construct-binary-tree-from-preorder-and-inorder-traversal', difficulty: 'medium', pattern: ['trees', 'recursion', 'dfs', 'arrays'], platform: 'leetcode', problemId: '105', url: 'https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/', frequency: 'frequent', tags: ['tree', 'depth-first search', 'array'] },
      { title: 'Binary Tree Inorder Traversal', slug: 'binary-tree-inorder-traversal', difficulty: 'easy', pattern: ['trees', 'recursion', 'dfs', 'stack'], platform: 'leetcode', problemId: '94', url: 'https://leetcode.com/problems/binary-tree-inorder-traversal/', frequency: 'frequent', tags: ['tree', 'depth-first search', 'stack'] },
      { title: 'Find Mode in Binary Search Tree', slug: 'find-mode-in-binary-search-tree', difficulty: 'easy', pattern: ['trees', 'recursion', 'dfs', 'hashing'], platform: 'leetcode', problemId: '501', url: 'https://leetcode.com/problems/find-mode-in-binary-search-tree/', frequency: 'medium', tags: ['tree', 'depth-first search', 'hash table'] },
      { title: 'Minimum Absolute Difference in BST', slug: 'minimum-absolute-difference-in-bst', difficulty: 'easy', pattern: ['trees', 'recursion', 'dfs'], platform: 'leetcode', problemId: '530', url: 'https://leetcode.com/problems/minimum-absolute-difference-in-bst/', frequency: 'medium', tags: ['tree', 'depth-first search'] },
      { title: 'Kth Smallest Element in a BST', slug: 'kth-smallest-element-in-a-bst', difficulty: 'medium', pattern: ['trees', 'recursion', 'dfs', 'binary_search'], platform: 'leetcode', problemId: '230', url: 'https://leetcode.com/problems/kth-smallest-element-in-a-bst/', frequency: 'frequent', tags: ['tree', 'depth-first search', 'binary search'] },
      { title: 'Validate Binary Search Tree', slug: 'validate-binary-search-tree', difficulty: 'medium', pattern: ['trees', 'recursion', 'dfs', 'binary_search'], platform: 'leetcode', problemId: '98', url: 'https://leetcode.com/problems/validate-binary-search-tree/', frequency: 'frequent', tags: ['tree', 'depth-first search', 'binary search'] },
      { title: 'Binary Search Tree Iterator', slug: 'binary-search-tree-iterator', difficulty: 'medium', pattern: ['trees', 'stack', 'design'], platform: 'leetcode', problemId: '173', url: 'https://leetcode.com/problems/binary-search-tree-iterator/', frequency: 'common', tags: ['tree', 'stack', 'design'] },
      { title: 'Balanced Binary Tree', slug: 'balanced-binary-tree', difficulty: 'easy', pattern: ['trees', 'recursion', 'dfs'], platform: 'leetcode', problemId: '110', url: 'https://leetcode.com/problems/balanced-binary-tree/', frequency: 'frequent', tags: ['tree', 'depth-first search'] },
      { title: 'Binary Tree Postorder Traversal', slug: 'binary-tree-postorder-traversal', difficulty: 'easy', pattern: ['trees', 'recursion', 'dfs', 'stack'], platform: 'leetcode', problemId: '145', url: 'https://leetcode.com/problems/binary-tree-postorder-traversal/', frequency: 'medium', tags: ['tree', 'depth-first search', 'stack'] },
      { title: 'Diameter of Binary Tree', slug: 'diameter-of-binary-tree', difficulty: 'easy', pattern: ['trees', 'recursion', 'dfs'], platform: 'leetcode', problemId: '543', url: 'https://leetcode.com/problems/diameter-of-binary-tree/', frequency: 'common', tags: ['tree', 'depth-first search'] },
      { title: 'Maximum Depth of Binary Tree', slug: 'maximum-depth-of-binary-tree', difficulty: 'easy', pattern: ['trees', 'recursion', 'dfs'], platform: 'leetcode', problemId: '104', url: 'https://leetcode.com/problems/maximum-depth-of-binary-tree/', frequency: 'frequent', tags: ['tree', 'depth-first search'] },
      { title: 'All Nodes Distance K in Binary Tree', slug: 'all-nodes-distance-k-in-binary-tree', difficulty: 'medium', pattern: ['trees', 'recursion', 'dfs', 'bfs'], platform: 'leetcode', problemId: '863', url: 'https://leetcode.com/problems/all-nodes-distance-k-in-binary-tree/', frequency: 'medium', tags: ['tree', 'depth-first search', 'breadth-first search'] },
      { title: 'House Robber III', slug: 'house-robber-iii', difficulty: 'medium', pattern: ['trees', 'recursion', 'dfs', 'dynamic_programming'], platform: 'leetcode', problemId: '337', url: 'https://leetcode.com/problems/house-robber-iii/', frequency: 'medium', tags: ['tree', 'depth-first search', 'dynamic programming'] },
      { title: 'Delete Nodes And Return Forest', slug: 'delete-nodes-and-return-forest', difficulty: 'medium', pattern: ['trees', 'recursion', 'dfs'], platform: 'leetcode', problemId: '1110', url: 'https://leetcode.com/problems/delete-nodes-and-return-forest/', frequency: 'medium', tags: ['tree', 'depth-first search'] },
      { title: 'Find Leaves of Binary Tree', slug: 'find-leaves-of-binary-tree', difficulty: 'medium', pattern: ['trees', 'recursion', 'dfs'], platform: 'leetcode', problemId: '366', url: 'https://leetcode.com/problems/find-leaves-of-binary-tree/', frequency: 'medium', tags: ['tree', 'depth-first search'] },
      { title: 'Height of Binary Tree After Subtree Removal Queries', slug: 'height-of-binary-tree-after-subtree-removal-queries', difficulty: 'hard', pattern: ['trees', 'recursion', 'dfs'], platform: 'leetcode', problemId: '2471', url: 'https://leetcode.com/problems/height-of-binary-tree-after-subtree-removal-queries/', frequency: 'rare', tags: ['tree', 'depth-first search'] },
      { title: 'Binary Tree Maximum Path Sum', slug: 'binary-tree-maximum-path-sum', difficulty: 'hard', pattern: ['trees', 'recursion', 'dfs', 'dynamic_programming'], platform: 'leetcode', problemId: '124', url: 'https://leetcode.com/problems/binary-tree-maximum-path-sum/', frequency: 'frequent', tags: ['tree', 'depth-first search', 'dynamic programming'] },
      { title: 'Binary Tree Right Side View', slug: 'binary-tree-right-side-view', difficulty: 'medium', pattern: ['trees', 'recursion', 'dfs', 'bfs'], platform: 'leetcode', problemId: '199', url: 'https://leetcode.com/problems/binary-tree-right-side-view/', frequency: 'common', tags: ['tree', 'depth-first search', 'breadth-first search'] },
      { title: 'Binary Tree Zigzag Level Order Traversal', slug: 'binary-tree-zigzag-level-order-traversal', difficulty: 'medium', pattern: ['trees', 'bfs', 'stack'], platform: 'leetcode', problemId: '103', url: 'https://leetcode.com/problems/binary-tree-zigzag-level-order-traversal/', frequency: 'common', tags: ['tree', 'breadth-first search', 'stack'] },
      { title: 'Find Largest Value in Each Tree Row', slug: 'find-largest-value-in-each-tree-row', difficulty: 'medium', pattern: ['trees', 'bfs'], platform: 'leetcode', problemId: '515', url: 'https://leetcode.com/problems/find-largest-value-in-each-tree-row/', frequency: 'medium', tags: ['tree', 'breadth-first search'] },
      { title: 'Maximum Level Sum of a Binary Tree', slug: 'maximum-level-sum-of-a-binary-tree', difficulty: 'medium', pattern: ['trees', 'bfs'], platform: 'leetcode', problemId: '1161', url: 'https://leetcode.com/problems/maximum-level-sum-of-a-binary-tree/', frequency: 'medium', tags: ['tree', 'breadth-first search'] },
      { title: 'Binary Tree Level Order Traversal', slug: 'binary-tree-level-order-traversal', difficulty: 'medium', pattern: ['trees', 'bfs'], platform: 'leetcode', problemId: '102', url: 'https://leetcode.com/problems/binary-tree-level-order-traversal/', frequency: 'frequent', tags: ['tree', 'breadth-first search'] },
      { title: 'Lowest Common Ancestor of a Binary Tree', slug: 'lowest-common-ancestor-of-a-binary-tree', difficulty: 'medium', pattern: ['trees', 'recursion', 'dfs'], platform: 'leetcode', problemId: '236', url: 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/', frequency: 'frequent', tags: ['tree', 'depth-first search'] },
      { title: 'Lowest Common Ancestor of a Binary Search Tree', slug: 'lowest-common-ancestor-of-a-binary-search-tree', difficulty: 'easy', pattern: ['trees', 'recursion', 'dfs', 'binary_search'], platform: 'leetcode', problemId: '235', url: 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/', frequency: 'common', tags: ['tree', 'depth-first search', 'binary search'] },
      { title: 'Subtree of Another Tree', slug: 'subtree-of-another-tree', difficulty: 'easy', pattern: ['trees', 'recursion', 'dfs'], platform: 'leetcode', problemId: '572', url: 'https://leetcode.com/problems/subtree-of-another-tree/', frequency: 'common', tags: ['tree', 'depth-first search'] },
      { title: 'Find Duplicate Subtrees', slug: 'find-duplicate-subtrees', difficulty: 'medium', pattern: ['trees', 'recursion', 'dfs', 'hashing', 'serialization'], platform: 'leetcode', problemId: '652', url: 'https://leetcode.com/problems/find-duplicate-subtrees/', frequency: 'medium', tags: ['tree', 'depth-first search', 'hash table', 'serialization'] },
      { title: 'Serialize and Deserialize Binary Tree', slug: 'serialize-and-deserialize-binary-tree', difficulty: 'hard', pattern: ['trees', 'recursion', 'dfs', 'bfs', 'serialization', 'design'], platform: 'leetcode', problemId: '297', url: 'https://leetcode.com/problems/serialize-and-deserialize-binary-tree/', frequency: 'frequent', tags: ['tree', 'depth-first search', 'breadth-first search', 'design'] },
    ],
  },
};

// All patterns combined
const allPatterns = [
  questionPatterns.two_pointer,
  questionPatterns.array_matrix,
  questionPatterns.linked_list,
  questionPatterns.tree_traversal,
];

export async function seedAllCodingProblems(): Promise<{ inserted: number; skipped: number; total: number }> {
    let inserted = 0;
    let skipped = 0;
    const duplicates = new Set<string>();
    const existingRows = await CodingProblem.find({}).select('platform problemId').lean();
    const existingKeys = new Set(existingRows.map(row => `${row.platform}:${row.problemId}`));

    for (const category of allPatterns) {
      for (const problem of category.problems) {
        // Create unique compound key to identify duplicates
        const compositeKey = `${problem.platform}:${problem.problemId}`;

        // Skip if already seeded in this run
        if (duplicates.has(compositeKey)) {
          skipped++;
          continue;
        }

        if (existingKeys.has(compositeKey)) {
          duplicates.add(compositeKey);
          skipped++;
          continue;
        }

        // Create the problem.
        // The curated table only carries title/difficulty/pattern/tags, but the
        // schema requires a description. Failing validation here aborted the
        // whole seed on the first insert, which is why the coding bank was
        // always empty and coding sections produced zero questions.
        const document = {
          ...problem,
          description: (problem as { description?: string }).description?.trim() || problemStatement(problem),
          // The curated table uses low/medium/high; the schema allows
          // rare/occasional/common/frequent.
          frequency: ['rare', 'occasional', 'common', 'frequent'].includes(problem.frequency)
            ? problem.frequency
            : ({ low: 'rare', medium: 'occasional', high: 'frequent' } as Record<string, string>)[problem.frequency] || 'occasional',
          // Tags carry pattern names that are not in the schema enum
          // (e.g. 'hashing'); keep only recognised ones so the seed completes.
          pattern: (problem.pattern || []).filter(p => PATTERN_ENUM.includes(p)),
        };
        let didInsert = false;
        try {
          const result = await CodingProblem.updateOne(
            { platform:problem.platform, problemId:problem.problemId },
            { $setOnInsert:document }, { upsert:true, runValidators:true });
          if (result.upsertedCount) didInsert = true;
          else skipped++;
        } catch (error:any) {
          // Concurrent application replicas can seed at the same time; unique
          // platform/problem IDs make that harmless and repeatable on restart.
          if (error.code !== 11000) throw error;
          skipped++;
        }

        duplicates.add(compositeKey);
        existingKeys.add(compositeKey);
        if (didInsert) inserted++;
      }
    }
    return { inserted, skipped, total: duplicates.size };
}

if (require.main === module) {
  mongoose.connect(config.database.uri, config.database.options)
    .then(async () => {
      console.log('Connected to MongoDB; seeding curated coding problems...');
      const result = await seedAllCodingProblems();
      console.log(`Coding bank ready: ${result.inserted} inserted, ${result.skipped} already present, ${result.total} curated entries.`);
      await mongoose.disconnect();
    })
    .catch(async error => {
      console.error('Coding problem seed failed:', error);
      await mongoose.disconnect().catch(() => undefined);
      process.exitCode = 1;
    });
}
