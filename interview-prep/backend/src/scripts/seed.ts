import mongoose from 'mongoose';
import config from '../config';
import { Topic, Subtopic } from '../modules/skill-graph/skill-graph.model';
import { Question } from '../modules/questions/question.model';
import { CodingProblem } from '../modules/coding/coding-problem.model';

// Seed data
const seedData = {
  topics: [
    {
      name: 'Java',
      description: 'Java programming language fundamentals and advanced concepts',
      category: 'programming_language',
      difficulty: 'medium',
      interviewPriority: 'very_high',
      estimatedStudyHours: 20,
      isCore: true,
      tag: 'language',
      subtopics: [
        { name: 'Collections Framework', description: 'List, Set, Map, Queue implementations and internals', difficulty: 'medium', isCore: true },
        { name: 'JVM Internals', description: 'JVM architecture, class loading, bytecode, memory areas', difficulty: 'hard', isCore: true },
        { name: 'Concurrency', description: 'Threads, synchronization, locks, concurrent collections', difficulty: 'hard', isCore: true },
        { name: 'Streams API', description: 'Functional-style operations on streams of elements', difficulty: 'medium', isCore: true },
        { name: 'Generics', description: 'Type parameters, wildcards, type erasure', difficulty: 'medium', isCore: true },
        { name: 'Exception Handling', description: 'Exception types, try-catch, custom exceptions', difficulty: 'easy', isCore: true },
      ],
    },
    {
      name: 'Spring Boot',
      description: 'Spring Framework and Spring Boot framework',
      category: 'framework',
      difficulty: 'medium',
      interviewPriority: 'very_high',
      estimatedStudyHours: 15,
      isCore: true,
      tag: 'framework',
      subtopics: [
        { name: 'Dependency Injection', description: 'IoC container, bean configuration, DI types', difficulty: 'medium', isCore: true },
        { name: 'Bean Lifecycle', description: 'Bean scopes, initialization, destruction callbacks', difficulty: 'medium', isCore: true },
        { name: 'REST Controllers', description: '@RestController, request mapping, response handling', difficulty: 'medium', isCore: true },
        { name: 'Spring Security', description: 'Authentication, authorization, JWT, method security', difficulty: 'hard', isCore: true },
        { name: 'Spring Data JPA', description: 'Repositories, entities, relationships, queries', difficulty: 'hard', isCore: true },
        { name: 'Transactions', description: '@Transactional, isolation levels, propagation', difficulty: 'hard', isCore: true },
        { name: 'Auto-Configuration', description: 'Spring Boot auto-config, conditions, customizing', difficulty: 'hard', isCore: true },
        { name: 'Actuator & Monitoring', description: 'Health checks, metrics, endpoints, production monitoring', difficulty: 'medium', isCore: true },
      ],
    },
    {
      name: 'JavaScript',
      description: 'JavaScript fundamentals and advanced concepts',
      category: 'programming_language',
      difficulty: 'medium',
      interviewPriority: 'high',
      estimatedStudyHours: 15,
      isCore: true,
      tag: 'language',
      subtopics: [
        { name: 'Execution Context', description: 'Call stack, execution context, scope, hoisting', difficulty: 'medium', isCore: true },
        { name: 'Closures', description: 'Lexical scoping, closure creation, practical uses', difficulty: 'medium', isCore: true },
        { name: 'Prototypes', description: 'Prototypal inheritance, prototype chain, __proto__', difficulty: 'hard', isCore: true },
        { name: 'Event Loop', description: 'Event loop, microtasks, macrotasks, async execution', difficulty: 'hard', isCore: true },
        { name: 'Promise Resolution', description: 'Promise states, chaining, error handling, async/await', difficulty: 'medium', isCore: true },
        { name: 'Memory Management', description: 'Memory allocation, garbage collection, leaks', difficulty: 'medium', isCore: true },
      ],
    },
    {
      name: 'Node.js',
      description: 'Node.js runtime and server-side JavaScript',
      category: 'runtime',
      difficulty: 'medium',
      interviewPriority: 'high',
      estimatedStudyHours: 12,
      isCore: true,
      tag: 'runtime',
      subtopics: [
        { name: 'Event Loop', description: 'Node.js event loop, phases, timers, I/O', difficulty: 'hard', isCore: true },
        { name: 'Streams', description: 'Readable, writable, duplex, transform streams', difficulty: 'medium', isCore: true },
        { name: 'Buffers', description: 'Binary data handling, buffer manipulation', difficulty: 'medium', isCore: true },
        { name: 'Worker Threads', description: 'Multi-threading, worker threads, thread pool', difficulty: 'hard', isCore: true },
        { name: 'Express.js', description: 'Middleware, routing, error handling, REST APIs', difficulty: 'medium', isCore: true },
        { name: 'Memory Leaks', description: 'Common causes, detection, prevention, debugging', difficulty: 'medium', isCore: true },
      ],
    },
    {
      name: 'System Design',
      description: 'System design fundamentals, distributed systems, and architecture',
      category: 'architecture',
      difficulty: 'hard',
      interviewPriority: 'very_high',
      estimatedStudyHours: 30,
      isCore: true,
      tag: 'architecture',
      subtopics: [
        { name: 'Scalability', description: 'Horizontal vs vertical scaling, load balancing, sharding', difficulty: 'hard', isCore: true },
        { name: 'Caching', description: 'Cache strategies, CDN, Redis, cache invalidation', difficulty: 'medium', isCore: true },
        { name: 'Database Design', description: 'SQL vs NoSQL, indexing, partitioning, replication', difficulty: 'hard', isCore: true },
        { name: 'Message Queues', description: 'Kafka, RabbitMQ, SQS, event-driven architectures', difficulty: 'medium', isCore: true },
        { name: 'Reliability', description: 'Fault tolerance, retries, circuit breakers, idempotency', difficulty: 'medium', isCore: true },
        { name: 'Security', description: 'Authentication, authorization, encryption, common vulnerabilities', difficulty: 'medium', isCore: true },
      ],
    },
    {
      name: 'MongoDB',
      description: 'MongoDB document database',
      category: 'database',
      difficulty: 'medium',
      interviewPriority: 'high',
      estimatedStudyHours: 10,
      isCore: true,
      tag: 'database',
      subtopics: [
        { name: 'Document Modeling', description: 'Embedding vs referencing, schema design patterns', difficulty: 'medium', isCore: true },
        { name: 'Indexing', description: 'Indexes, compound indexes, unique indexes, text indexes', difficulty: 'medium', isCore: true },
        { name: 'Aggregation', description: 'Aggregation pipeline, stages, operators', difficulty: 'medium', isCore: true },
        { name: 'Transactions', description: 'Multi-document transactions, ACID properties', difficulty: 'medium', isCore: true },
        { name: 'Replication', description: 'Replica sets, read/write concerns, failover', difficulty: 'hard', isCore: true },
        { name: 'Sharding', description: 'Sharding strategies, chunks, balancer, key selection', difficulty: 'hard', isCore: true },
      ],
    },
    {
      name: 'REST APIs',
      description: 'RESTful API design and implementation',
      category: 'backend',
      difficulty: 'easy',
      interviewPriority: 'high',
      estimatedStudyHours: 8,
      isCore: true,
      tag: 'backend',
      subtopics: [
        { name: 'HTTP Methods', description: 'GET, POST, PUT, PATCH, DELETE, semantics', difficulty: 'easy', isCore: true },
        { name: 'Status Codes', description: '2xx, 3xx, 4xx, 5xx status codes and usage', difficulty: 'easy', isCore: true },
        { name: 'API Design', description: 'Resource naming, versioning, pagination, filtering', difficulty: 'medium', isCore: true },
        { name: 'Authentication', description: 'API keys, JWT, OAuth, token management', difficulty: 'medium', isCore: true },
        { name: 'Idempotency', description: 'Idempotent methods, idempotency keys, retry safety', difficulty: 'medium', isCore: true },
        { name: 'Rate Limiting', description: 'Rate limiting strategies, throttling, quotas', difficulty: 'medium', isCore: true },
      ],
    },
    {
      name: 'AWS',
      description: 'Amazon Web Services cloud platform',
      category: 'cloud',
      difficulty: 'medium',
      interviewPriority: 'high',
      estimatedStudyHours: 15,
      isCore: true,
      tag: 'cloud',
      subtopics: [
        { name: 'EC2', description: 'Virtual machines, instance types, security groups, scaling', difficulty: 'medium', isCore: true },
        { name: 'Lambda', description: 'Serverless computing, event triggers, cold starts', difficulty: 'medium', isCore: true },
        { name: 'S3', description: 'Object storage, buckets, permissions, lifecycle policies', difficulty: 'easy', isCore: true },
        { name: 'DynamoDB', description: 'NoSQL database, partitions, indexes, streams', difficulty: 'medium', isCore: true },
        { name: 'API Gateway', description: 'REST/WebSocket APIs, authentication, throttling', difficulty: 'medium', isCore: true },
        { name: 'IAM', description: 'Users, roles, policies, permissions, security best practices', difficulty: 'medium', isCore: true },
      ],
    },
    {
      name: 'React',
      description: 'React frontend library',
      category: 'frontend',
      difficulty: 'medium',
      interviewPriority: 'medium',
      estimatedStudyHours: 12,
      isCore: true,
      tag: 'frontend',
      subtopics: [
        { name: 'Rendering', description: 'Virtual DOM, reconciliation, render cycles', difficulty: 'medium', isCore: true },
        { name: 'Hooks', description: 'useState, useEffect, useMemo, useCallback, custom hooks', difficulty: 'medium', isCore: true },
        { name: 'State Management', description: 'Component state, Context, state libraries', difficulty: 'medium', isCore: true },
        { name: 'Performance', description: 'Memoization, code splitting, lazy loading, optimization', difficulty: 'medium', isCore: true },
      ],
    },
    {
      name: 'AI/LLM',
      description: 'Artificial intelligence and large language models',
      category: 'ai_ml',
      difficulty: 'medium',
      interviewPriority: 'medium',
      estimatedStudyHours: 12,
      isCore: false,
      tag: 'ai',
      subtopics: [
        { name: 'Prompt Engineering', description: 'Prompt design, few-shot, chain-of-thought, structured outputs', difficulty: 'medium', isCore: false },
        { name: 'Embeddings', description: 'Vector representations, similarity, semantic search', difficulty: 'medium', isCore: false },
        { name: 'RAG', description: 'Retrieval augmented generation, chunking, retrieval, reranking', difficulty: 'medium', isCore: false },
        { name: 'Evaluation', description: 'Model evaluation, hallucination detection, accuracy metrics', difficulty: 'medium', isCore: false },
      ],
    },
  ],
  curatedQuestions: [
    // Java Questions
    {
      topic: 'Java',
      subtopic: 'Collections Framework',
      question: 'Explain the internal working of HashMap in Java. How does it handle collisions?',
      concepts: ['hashmap', 'hashing', 'collision resolution', 'equals', 'hashcode'],
      difficulty: 'MEDIUM',
      questionType: 'INTERNAL_WORKING',
      interviewPriority: 'HIGH',
      resumeRelevance: 'MEDIUM',
      expectedAnswerDepth: 'DEEP',
      estimatedAnswerTimeSeconds: 180,
      followUpConcepts: ['hash collisions', 'load factor', 'rehashing'],
      tags: ['collections', 'hashmap', 'data structures'],
      provenance: 'CURATED',
      qualityStatus: 'approved',
      isHidden: false,
      isDeprecated: false,
      shortAnswer: 'HashMap uses an array of buckets. Each bucket can hold a linked list (or tree in Java 8+) of entries with the same hash. Key lookup involves computing hash, finding bucket index, and traversing the chain/tree using equals(). Collisions are handled by chaining.',
      detailedAnswer: 'HashMap internals:\n\n1. **Internal Structure**: Array of Node<K,V>[] table with default capacity 16\n\n2. **Hash Calculation**: Uses key.hashCode() with supplemental hash function to spread hash values\n\n3. **Bucket Index**: (n - 1) & hash where n is table length\n\n4. **Collision Resolution**:\n   - Java 7 and earlier: Linked list in each bucket ( chaining)\n   - Java 8+: Converts to balanced tree (TreeNode) when bucket size > threshold (8)\n   - Tree improves O(n) lookup to O(log n) in worst case\n\n5. **Equals and HashCode Contract**:\n   - Equal objects must have equal hashCodes\n   - Equal hashCodes do not require equal objects\n   - Breaking contract causes HashMap to fail\n\n6. **Load Factor**: Default 0.75, triggers resizing when size > capacity * loadFactor\n\n7. **Rehashing**: New capacity = 2x old capacity, all entries rehashed\n\n8. **Time Complexity**:\n   - Average: O(1) for get/put\n   - Worst case (all same hash): O(n) with linked list, O(log n) with tree',
      archetype: 'DEEP_DIVE',
    },
    {
      topic: 'Java',
      subtopic: 'Concurrency',
      question: 'What is the Java Memory Model? Explain volatile and its guarantees.',
      concepts: ['java memory model', 'volatile', 'happens-before', 'visibility', 'memory consistency'],
      difficulty: 'HARD',
      questionType: 'INTERNAL_WORKING',
      interviewPriority: 'HIGH',
      resumeRelevance: 'MEDIUM',
      expectedAnswerDepth: 'DEEP',
      estimatedAnswerTimeSeconds: 180,
      followUpConcepts: ['atomicity', 'synchronized', 'locks', 'completablefuture'],
      tags: ['concurrency', 'jmm', 'volatile', 'memory'],
      provenance: 'CURATED',
      qualityStatus: 'approved',
      isHidden: false,
      isDeprecated: false,
      shortAnswer: 'JMM defines how threads interact through memory. volatile provides visibility guarantee: writes are immediately visible to other threads. It also establishes happens-before relationships but does not guarantee atomicity.',
      detailedAnswer: 'Java Memory Model (JMM):\n\n1. **Purpose**: Defines legal behaviors for multithreaded programs, specifying when writes become visible to other threads\n\n2. **Key Concepts**:\n   - **Happens-Before**: Partial ordering of actions, ensures visibility\n   - **Visibility**: When changes become visible to other threads\n   - **Atomicity**: Operations execute as single unit\n\n3. **Volatile Keyword**:\n   - **Visibility Guarantee**: Write to volatile variable happens-before subsequent read\n   - **No Caching**: Value always read from main memory\n   - **Ordering**: Prevents instruction reordering around volatile access\n   - **NOT Atomic**: volatile does NOT make compound operations atomic (i++ is not atomic)\n\n4. **What volatile DOES**:\n   - Ensures visibility of writes across threads\n   - Prevents instruction reordering (can be used for safe publishing)\n   - Establishes happens-before relationships\n\n5. **What volatile DOES NOT DO**:\n   - Does not make increment operations atomic\n   - Does not prevent race conditions on compound operations\n   - Not a replacement for synchronized in most cases\n\n6. **Common Use Cases**:\n   - Status flags: `volatile boolean stopped`\n   - One-time safe publication\n   - Double-checked locking (with proper implementation)',
      archetype: 'CONCURRENCY',
    },
    {
      topic: 'Java',
      subtopic: 'Streams API',
      question: 'How does Stream API handle short-circuiting? Explain with examples.',
      concepts: ['streams', 'short-circuiting', 'parallel streams', 'lazy evaluation'],
      difficulty: 'MEDIUM',
      questionType: 'CONCEPTUAL',
      interviewPriority: 'MEDIUM',
      resumeRelevance: 'MEDIUM',
      expectedAnswerDepth: 'MODERATE',
      estimatedAnswerTimeSeconds: 120,
      followUpConcepts: ['intermediate operations', 'terminal operations', 'parallel execution'],
      tags: ['streams', 'java8', 'functional'],
      provenance: 'CURATED',
      qualityStatus: 'approved',
      isHidden: false,
      isDeprecated: false,
      shortAnswer: 'Short-circuiting terminal operations (anyMatch, allMatch, noneMatch, findFirst, findAny) can produce result without processing entire stream. Intermediate operations like limit() also short-circuit. In parallel streams, findAny may not be first element.',
      detailedAnswer: 'Stream Short-Circuiting:\n\n1. **Short-Circuiting Terminal Operations**:\n   - `anyMatch(Predicate)`: Returns true if any element matches\n   - `allMatch(Predicate)`: Returns true if all match (may stop early on false)\n   - `noneMatch(Predicate)`: Returns true if no elements match\n   - `findFirst()`: Returns first element\n   - `findAny()`: Returns any element (may differ from first in parallel)\n\n2. **How it Works**:\n   - Stream doesn\'t traverse all elements if result determined early\n   - For findFirst(): stops after finding first matching element\n   - For anyMatch(): stops after finding first true match\n\n3. **Intermediate Short-Circuiting**:\n   - `limit(n)`: Limits to n elements, short-circuits after n\n   - `parallel().findAny()`: May return non-first element for performance\n\n4. **Important Considerations**:\n   - Stateful operations (sorted, distinct) may need full input before producing\n   - Short-circuiting only works if upstream operations allow early termination\n   - Parallel streams: findAny() non-deterministic\n\n5. **Example**:\n```java\nList<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5);\nboolean result = numbers.stream()\n    .map(x -> { System.out.println("Processing " + x); return x; })\n    .anyMatch(x -> x > 3);\n// Output: Only processes 1, 2, 3, 4 (stops at 4)\n```',
      archetype: 'INTERNAL_WORKING',
    },
    // Spring Boot Questions
    {
      topic: 'Spring Boot',
      subtopic: 'Dependency Injection',
      question: 'Explain Spring Bean lifecycle. When are @PostConstruct and @PreDestroy called?',
      concepts: ['bean lifecycle', 'spring container', 'initialization', 'destruction', 'postconstruct', 'predestroy'],
      difficulty: 'MEDIUM',
      questionType: 'INTERNAL_WORKING',
      interviewPriority: 'HIGH',
      resumeRelevance: 'MEDIUM',
      expectedAnswerDepth: 'DEEP',
      estimatedAnswerTimeSeconds: 120,
      followUpConcepts: ['bean scopes', 'lazy initialization', 'BeanPostProcessor'],
      tags: ['spring', 'bean lifecycle', 'di'],
      provenance: 'CURATED',
      qualityStatus: 'approved',
      isHidden: false,
      isDeprecated: false,
      shortAnswer: 'Bean lifecycle: Instantiation → Populate Properties → Initialization (BeanPostProcessor.beforeProcessing, @PostConstruct, afterPropertiesSet, BeanPostProcessor.afterProcessing) → Ready to use → Destruction (@PreDestroy, DisposableBean.destroy).',
      detailedAnswer: 'Spring Bean Lifecycle:\n\n1. **Instantiation**:\n   - Container Finds Bean Definition\n   - Creates Bean Instance via Constructor or Factory Method\n\n2. **Populate Properties**:\n   - Dependency Injection (by name, type, constructor)\n   - Bean references resolved and injected\n\n3. **Initialization Phase**:\n   - **BeanPostProcessor.postProcessBeforeInitialization()**: Pre-processing\n   - **@PostConstruct**: Annotated method called after DI\n   - **InitializingBean.afterPropertiesSet()**: If implemented\n   - **Custom init-method**: If specified in XML/annotation\n   - **BeanPostProcessor.postProcessAfterInitialization()**: Post-processing\n\n4. **Ready State**: Bean is fully initialized and available for use\n\n5. **Destruction Phase**:\n   - **@PreDestroy**: Annotated method called before destruction\n   - **DisposableBean.destroy()**: If implemented\n   - **Custom destroy-method**: If specified\n   - Bean discarded\n\n6. **Bean Scopes Affect Lifecycle**:\n   - **Singleton**: One instance, lifecycle tied to container\n   - **Prototype**: New instance each time, container doesn\'t manage full lifecycle\n   - **Request/Session/Application**: Web-aware scopes\n\n7. **BeanPostProcessor**: Can modify bean instances before/after initialization',
      archetype: 'DEEP_DIVE',
    },
    {
      topic: 'Spring Boot',
      subtopic: 'Transactions',
      question: 'What is @Transactional and how does Spring implement declarative transactions?',
      concepts: ['transactional', 'aop', 'spring transactions', 'proxies', 'rollback'],
      difficulty: 'HARD',
      questionType: 'INTERNAL_WORKING',
      interviewPriority: 'HIGH',
      resumeRelevance: 'MEDIUM',
      expectedAnswerDepth: 'DEEP',
      estimatedAnswerTimeSeconds: 180,
      followUpConcepts: ['propagation', 'isolation', 'rollback rules', 'programmatic transactions'],
      tags: ['spring', 'transactions', 'aop', 'declarative'],
      provenance: 'CURATED',
      qualityStatus: 'approved',
      isHidden: false,
      isDeprecated: false,
      shortAnswer: '@Transactional enables declarative transaction management using AOP proxies. Spring creates a proxy that intercepts method calls, opens/closes transactions, handles commits/rollbacks. Uses JDK dynamic proxies or CGLIB. Default rollback on RuntimeException and Error.',
      detailedAnswer: '@Transactional Implementation:\n\n1. **How it Works**:\n   - **AOP Proxy**: Spring creates proxy around bean\n   - **TransactionInterceptor**: Intercepts method calls\n   - **PlatformTransactionManager**: Manages actual transaction\n\n2. **Proxy Types**:\n   - **JDK Dynamic Proxy**: For interfaces (default)\n   - **CGLIB Proxy**: For classes (no interface)\n   - Proxy calls real method within transaction context\n\n3. **Transaction Lifecycle**:\n   - **Before Method**: Open transaction (or join existing)\n   - **Method Execution**: Execute business logic\n   - **After Method**: Commit (or rollback on exception)\n   - **Cleanup**: Release resources\n\n4. **Default Behavior**:\n   - **Rollback**: RuntimeException and Error\n   - **Commit**: Checked exceptions (non-RuntimeException)\n   - **Configurable**: @Transactional(rollbackFor = Exception.class)\n\n5. **Propagation Levels**:\n   - **REQUIRED** (default): Join existing or create new\n   - **REQUIRES_NEW**: Always create new, suspend existing\n   - **NESTED**: Create savepoint, rollback to savepoint on exception\n\n6. **Isolation Levels**:\n   - **DEFAULT**: Database default\n   - **READ_UNCOMMITTED, READ_COMMITTED, REPEATABLE_READ, SERIALIZABLE**\n\n7. **Common Pitfalls**:\n   - Self-invocation doesn\'t go through proxy\n   - @Transactional on private methods has no effect\n   - Internal method calls bypass transaction',
      archetype: 'DEEP_DIVE',
    },
    // JavaScript Questions
    {
      topic: 'JavaScript',
      subtopic: 'Event Loop',
      question: 'Explain the JavaScript event loop. How do microtasks and macrotasks differ?',
      concepts: ['event loop', 'call stack', 'microtasks', 'macrotasks', 'promises', 'settimeout'],
      difficulty: 'HARD',
      questionType: 'INTERNAL_WORKING',
      interviewPriority: 'VERY_HIGH',
      resumeRelevance: 'HIGH',
      expectedAnswerDepth: 'DEEP',
      estimatedAnswerTimeSeconds: 180,
      followUpConcepts: ['async await', 'promise resolution', 'task queue'],
      tags: ['javascript', 'event loop', 'asynchronous'],
      provenance: 'CURATED',
      qualityStatus: 'approved',
      isHidden: false,
      isDeprecated: false,
      shortAnswer: 'Event loop processes call stack first, then microtask queue (Promises, queueMicrotask), then macrotask queue (setTimeout, setInterval, I/O). Microtasks execute before next macrotask. Each macrotask may add more microtasks.',
      detailedAnswer: 'JavaScript Event Loop:\n\n1. **Components**:\n   - **Call Stack**: Executes synchronous code\n   - **Microtask Queue**: High priority, processed first (Promises, queueMicrotask)\n   - **Macrotask Queue**: Lower priority (setTimeout, setInterval, I/O, UI rendering)\n   - **Event Loop**: Monitors call stack, processes queues\n\n2. **Execution Order**:\n   1. Execute all synchronous code (call stack empty)\n   2. Process ALL microtasks\n   3. Process ONE macrotask\n   4. Process ALL microtasks from step 3\n   5. Repeat\n\n3. **Key Differences**:\n   - Microtasks: Promises, queueMicrotask, MutationObserver callbacks\n   - Macrotasks: setTimeout, setInterval, I/O callbacks, UI rendering\n\n4. **Why Microtasks First**:\n   - Guarantees Promise resolution happens before next rendering\n   - More predictable execution order\n   - Used by browser APIs for async operations\n\n5. **Example**:\n```javascript\nconsole.log(\'1\');\nsetTimeout(() => console.log(\'2\'), 0);\nPromise.resolve().then(() => console.log(\'3\'));\nconsole.log(\'4\');\n// Output: 1, 4, 3, 2 (NOT 1, 2, 3, 4)\n```\n\n6. **Practical Impact**:\n   - Promise.resolve().then() runs before setTimeout(fn, 0)\n   - Can starve macrotasks if microtask queue never empties\n   - Node.js: event loop phases have specific ordering',
      archetype: 'DEEP_DIVE',
    },
    {
      topic: 'JavaScript',
      subtopic: 'Closures',
      question: 'What are closures in JavaScript? Explain with practical examples.',
      concepts: ['closures', 'lexical scope', 'scope chain', 'function scope'],
      difficulty: 'MEDIUM',
      questionType: 'CONCEPTUAL',
      interviewPriority: 'HIGH',
      resumeRelevance: 'HIGH',
      expectedAnswerDepth: 'MODERATE',
      estimatedAnswerTimeSeconds: 120,
      followUpConcepts: ['memory leaks', 'currying', 'function factories'],
      tags: ['javascript', 'closures', 'scope'],
      provenance: 'CURATED',
      qualityStatus: 'approved',
      isHidden: false,
      isDeprecated: false,
      shortAnswer: 'Closure is a function that remembers its lexical scope even when executed outside that scope. It captures variables from outer function. Used for data privacy, function factories, currying, event handlers.',
      detailedAnswer: 'JavaScript Closures:\n\n1. **Definition**: Closure is the combination of a function and its lexical environment. Function "closes over" variables from outer scope.\n\n2. **How it Works**:\n   - Inner function has access to outer function\'s variables\n   - Variables are retained even after outer function returns\n   - Creates a scope chain\n\n3. **Example**:\n```javascript\nfunction createCounter() {\n  let count = 0;\n  return function() {\n    count++;\n    return count;\n  };\n}\nconst counter = createCounter();\ncounter(); // 1\ncounter(); // 2\n// \'count\' is preserved via closure\n```\n\n4. **Common Uses**:\n   - **Data Privacy/Emulation of private variables**: Variables can\'t be accessed directly\n   - **Function Factories**: Creating customized functions\n   - **Currying**: Partial application of functions\n   - **Event Handlers**: Preserving context\n   - **Iterators/Generators**: Maintaining state\n\n5. **Common Pitfall - Loop with var**:\n```javascript\nfor (var i = 1; i <= 3; i++) {\n  setTimeout(() => console.log(i), 1000);\n}\n// Prints: 4, 4, 4 (not 1, 2, 3)\n// All closures share same `i` variable\n\n// Fix with let (block scope):\nfor (let i = 1; i <= 3; i++) { ... }\n// Prints: 1, 2, 3\n```\n\n6. **Memory Considerations**:\n   - Closures retain referenced variables\n   - Can cause memory leaks if holding large objects unnecessarily\n   - GC can collect when closure no longer referenced',
      archetype: 'DEEP_DIVE',
    },
    // Node.js Questions
    {
      topic: 'Node.js',
      subtopic: 'Event Loop',
      question: 'Explain Node.js event loop phases. What happens in each phase?',
      concepts: ['event loop phases', 'timers', 'pending callbacks', 'poll', 'check', 'close callbacks'],
      difficulty: 'HARD',
      questionType: 'INTERNAL_WORKING',
      interviewPriority: 'HIGH',
      resumeRelevance: 'HIGH',
      expectedAnswerDepth: 'DEEP',
      estimatedAnswerTimeSeconds: 180,
      followUpConcepts: ['setimmediate', 'process.nexttick', 'libuv'],
      tags: ['nodejs', 'event loop', 'libuv', 'async'],
      provenance: 'CURATED',
      qualityStatus: 'approved',
      isHidden: false,
      isDeprecated: false,
      shortAnswer: 'Node.js event loop has 6 phases: timers (setTimeout/setInterval), pending callbacks (I/O errors), idle/prepare (internal), poll (I/O callbacks, blocking), check (setImmediate), close callbacks (socket close). process.nextTick runs between phases.',
      detailedAnswer: 'Node.js Event Loop Phases:\n\n1. **Timers Phase**:\n   - Executes callbacks scheduled by setTimeout() and setInterval()\n   - Only callbacks whose threshold has elapsed\n   - NOT exactly at specified time, but after threshold\n\n2. **Pending Callbacks Phase**:\n   - Executes I/O callbacks deferred to next loop iteration\n   - System errors like TCP errors\n   - Some internal callbacks\n\n3. **Idle, Prepare Phase**:\n   - Internal use only\n   - Parked briefly\n\n4. **Poll Phase**:\n   - **Most Important Phase**\n   - Retrieves new I/O events\n   - Executes I/O callbacks (almost all except close callbacks, timers, setImmediate)\n   - Can block here waiting for callbacks if:\n     - No callbacks pending\n     - No setImmediate scheduled\n     - No other work\n\n5. **Check Phase**:\n   - Executes setImmediate() callbacks\n   - Ran immediately after poll phase completes\n   - Use setImmediate() for callback after I/O events\n\n6. **Close Callbacks Phase**:\n   - Executes close event callbacks (socket.on(\'close\', ...))\n   - Some internal close events\n\n7. **process.nextTick() vs setImmediate()**:\n   - **nextTick()**: Processed after current operation completes, before event loop continues\n   - **setImmediate()**: Executed in check phase of event loop\n   - nextTick fires immediately, setImmediate fires in next iteration',
      archetype: 'DEEP_DIVE',
    },
    // System Design Questions
    {
      topic: 'System Design',
      subtopic: 'Scalability',
      question: 'Design a URL shortening service like bit.ly. How would you handle high traffic?',
      concepts: ['url shortening', 'scalability', 'id generation', 'caching', 'redirect'],
      difficulty: 'HARD',
      questionType: 'SYSTEM_DESIGN',
      interviewPriority: 'VERY_HIGH',
      resumeRelevance: 'MEDIUM',
      expectedAnswerDepth: 'DEEP',
      estimatedAnswerTimeSeconds: 600,
      isSystemDesign: true,
      functionalRequirements: ['Create short URL from long URL', 'Redirect short URL to original', 'Custom aliases optional'],
      nonFunctionalRequirements: ['High availability', 'Low latency redirects', 'Scalable to billions of URLs'],
      scaleRequirements: ['1000 new URLs/sec', '10M redirects/sec'],
      provenance: 'CURATED',
      qualityStatus: 'approved',
      isHidden: false,
      isDeprecated: false,
      shortAnswer: 'Use Base62 encoding of unique ID (auto-increment or distributed ID). Cache popular redirects with Redis. Use CDN for reads. Database sharding by hash of short code. Batch writes for analytics.',
      detailedAnswer: 'URL Shortening Service Design:\n\n1. **Requirements**:\n   - Create short URL: POST /shorten {url} → {shortCode}\n   - Redirect: GET /{code} → 301 to original URL\n   - Optional: custom aliases, analytics\n\n2. **Capacity Estimation**:\n   - 1000 new URLs/sec = 86.4M/day\n   - 10M redirects/sec = 864B/day\n   - Average short URL length: 7 chars Base62\n   - Storage: ~500 bytes per URL = 43TB for 10 years\n\n3. **ID Generation**:\n   - **Option 1**: Auto-increment DB ID + Base62 encode\n   - **Option 2**: Distributed ID (Twitter Snowflake)\n   - **Option 3**: Hash of URL (collision issues)\n   - Best: Distributed sequential ID for sortability\n\n4. **Database Design**:\n   - Keyspace: short_code → {original_url, created_at, user_id, expiration}\n   - Sharding: Hash of short_code for distribution\n   - Replication: Everywhere for reads\n\n5. **Caching Strategy**:\n   - Cache popular redirects (LRU)\n   - Redis/Memcached for fast lookup\n   - TTL based on access frequency\n   - Cache miss → DB → update cache\n\n6. **Scalability**:\n   - Read-heavy workload\n   - CDN for static assets\n   - Load balancer distributing reads\n   - Multiple cache layers\n\n7. **API Design**:\n   - Rate limiting on create endpoint\n   - Idempotent create (same URL → same code)\n   - Custom aliases: uniqueness check\n\n8. **Additional Features**:\n   - Analytics: click count, geo, referrer\n   - Expiration: TTL on URLs\n   - QR code generation\n   - Branded short domains',
      archetype: 'SCALABILITY',
    },
    // MongoDB Questions
    {
      topic: 'MongoDB',
      subtopic: 'Indexing',
      question: 'When would you use a compound index vs separate indexes? How does MongoDB use indexes for sorting?',
      concepts: ['compound indexes', 'index intersection', 'sorting', 'explain', 'query optimization'],
      difficulty: 'MEDIUM',
      questionType: 'CONCEPTUAL',
      interviewPriority: 'HIGH',
      resumeRelevance: 'MEDIUM',
      expectedAnswerDepth: 'MODERATE',
      estimatedAnswerTimeSeconds: 120,
      followUpConcepts: ['index order', 'prefix rule', 'covered queries'],
      tags: ['mongodb', 'indexing', 'performance'],
      provenance: 'CURATED',
      qualityStatus: 'approved',
      isHidden: false,
      isDeprecated: false,
      shortAnswer: 'Compound index for queries filtering on multiple fields in same query. Index order matters: {a:1, b:1} supports {a:1} and {a:1, b:1} queries. Index intersection uses multiple indexes together. For sorting, index must match sort order or provide covered sort.',
      detailedAnswer: 'MongoDB Indexing Strategy:\n\n1. **Compound Index**:\n   - Single index on multiple fields: `{a:1, b:1, c:1}`\n   - Used when queries filter/sort on multiple fields together\n   - **Prefix Rule**: Index on `{a,b,c}` supports:\n     - `{a:1}` queries\n     - `{a:1, b:1}` queries\n     - `{a:1, b:1, c:1}` queries\n   - Does NOT support `{b:1}` or `{b:1, c:1}` alone\n\n2. **Separate Indexes**:\n   - When queries use fields independently\n   - When query patterns vary\n   - Index intersection may combine multiple indexes\n\n3. **Index Intersection**:\n   - MongoDB can use multiple indexes for one query\n   - Combines results from each index\n   - Not always better than compound index\n   - Useful for unpredictable query patterns\n\n4. **Sorting with Indexes**:\n   - **Sort Must Match Index**: `{a:1, b:1}` index can sort `{a:1, b:1}` or `{a:-1, b:-1}`\n   - **Mixed Sort**: `{a:1, b:-1}` not supported by `{a:1, b:1}` index\n   - **Sort Limit**: Index can handle sort up to limit (for capped collections)\n   - **Blocking Sort**: Without index, MongoDB sorts in memory (100MB limit)\n\n5. **Covered Queries**:\n   - Query can be satisfied entirely from index\n   - No document access needed\n   - Fields in query + projection must be in index\n\n6. **EXPLAIN Output**:\n   - Look for: `IXSCAN` (index used), `FETCH` (documents), `SORT` (in-memory sort)\n   - Goals: More index scans, fewer fetches, no blocking sorts',
      archetype: 'DEEP_DIVE',
    },
    // AWS Questions
    {
      topic: 'AWS',
      subtopic: 'Lambda',
      question: 'What are Lambda cold starts and how can you minimize them?',
      concepts: ['lambda', 'cold start', 'provisioned concurrency', 'initialization', 'performance'],
      difficulty: 'MEDIUM',
      questionType: 'PRODUCTION_SCENARIO',
      interviewPriority: 'HIGH',
      resumeRelevance: 'HIGH',
      expectedAnswerDepth: 'MODERATE',
      estimatedAnswerTimeSeconds: 120,
      followUpConcepts: ['warm starts', 'layers', 'runtime selection'],
      tags: ['aws', 'lambda', 'serverless', 'performance'],
      provenance: 'CURATED',
      qualityStatus: 'approved',
      isHidden: false,
      isDeprecated: false,
      shortAnswer: 'Cold start: First invocation after idle period initializes runtime, downloads code, runs initialization. Mitigation: Provisioned concurrency, smaller packages, faster runtime (Go/Node.js vs Java), minimize dependencies, keep functions warm.',
      detailedAnswer: 'Lambda Cold Starts:\n\n1. **What is Cold Start**:\n   - First invocation (or after idle period) requires initialization\n   - Steps: Provision execution environment, download code, initialize runtime, load dependencies, run initialization code\n   - Adds latency: 50ms to several seconds\n\n2. **Causes**:\n   - New Lambda instance created\n   - After scaling events\n   - After periods of no traffic\n   - Code package too large\n   - Heavy initialization\n\n3. **Mitigation Strategies**:\n   - **Provisioned Concurrency**: Pre-warm instances, guarantees capacity\n   - **Minimize Deployment Package**: Remove unused dependencies, use layers\n   - **Faster Runtimes**: Node.js, Go generally faster than Java\n   - **Minimal Dependencies**: Fewer imports = faster init\n   - **Keep Warm**: Scheduled ping (CloudWatch Events)\n   - **Initializations**: Defer non-critical init\n\n4. **Provisioned Concurrency**:\n   - Pre-initialized instances ready to go\n   - Higher cost but guaranteed latency\n   - Use for latency-critical paths\n   - Can be auto-scaled based on traffic\n\n5. **Runtime Choices**:\n   - Node.js: Fast cold starts (~50-100ms)\n   - Go: Very fast (~50ms)\n   - Java: Slower (~200-500ms due to JVM warm-up)\n   - Python: Moderate\n\n6. **Package Optimization**:\n   - Remove dev dependencies\n   - Use Lambda layers for shared code\n   - Compress deployment package\n   - Tree-shake unused code\n\n7. **Code Design**:\n   - Reuse connections across invocations\n   - Initialize SDK clients outside handler\n   - Lazy initialization for optional features',
      archetype: 'PERFORMANCE',
    },
    // REST API Questions
    {
      topic: 'REST APIs',
      subtopic: 'Idempotency',
      question: 'What is idempotency in APIs? Why is it important and how do you implement it?',
      concepts: ['idempotency', 'http methods', 'retry safety', 'duplicate prevention'],
      difficulty: 'MEDIUM',
      questionType: 'CONCEPTUAL',
      interviewPriority: 'HIGH',
      resumeRelevance: 'HIGH',
      expectedAnswerDepth: 'DEEP',
      estimatedAnswerTimeSeconds: 120,
      followUpConcepts: ['retry logic', 'distributed systems', 'api design'],
      tags: ['rest', 'api design', 'idempotency', 'reliability'],
      provenance: 'CURATED',
      qualityStatus: 'approved',
      isHidden: false,
      isDeprecated: false,
      shortAnswer: 'Idempotency: Multiple identical requests produce same result as single request. Important for retry safety, network failures, duplicated requests. Implement with idempotency keys: client sends unique key, server stores result and returns cached response for duplicate keys.',
      detailedAnswer: 'Idempotency in APIs:\n\n1. **Definition**:\n   - Idempotent request: Same operation can be applied multiple times without different outcome\n   - Result same whether executed once or multiple times\n\n2. **Why Important**:\n   - **Network Failures**: Client retries after timeout, server already processed\n   - **Duplicate Requests**: Accidental double-clicks, retries\n   - **Distributed Systems**: Message redelivery, at-least-once delivery\n   - **User Experience**: Safe to retry without side effects\n\n3. **HTTP Method Idempotency**:\n   - **GET**: Read-only, naturally idempotent\n   - **PUT**: Replace resource, idempotent (same result each time)\n   - **DELETE**: Delete resource, idempotent (success even if already deleted)\n   - **POST**: Create resource, NOT idempotent (creates new each time)\n   - **PATCH**: Partially update, depends on implementation\n\n4. **Implementation Patterns**:\n   - **Idempotency Key**: Client generates unique key per operation\n     ```\nPOST /payments {\n  "idempotency_key": "uuid-1234",\n  "amount": 100\n}\n     ```\n   - Server stores key + response in cache/DB\n   - On duplicate key, return stored response\n\n5. **Idempotency Key Storage**:\n   - Redis with TTL (e.g., 24 hours)\n   - Database table with unique constraint\n   - Key includes: operation type, resource, key\n\n6. **Considerations**:\n   - Key uniqueness: UUID best\n   - TTL: Not permanent, cleanup needed\n   - Race conditions: Handle concurrent duplicate requests\n   - Audit trail: Log idempotency keys for debugging\n\n7. **Payment Example**:\n   - Charge card: Idempotent prevents double charge\n   - Key tied to user + amount + merchant',
      archetype: 'TRADE_OFF',
    },
  ],
  codingProblems: [
    {
      title: 'Two Sum',
      slug: 'two-sum',
      description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
      difficulty: 'easy',
      pattern: ['arrays', 'hashing'],
      platform: 'leetcode',
      problemId: '1',
      url: 'https://leetcode.com/problems/two-sum/',
      isInterviewRelevant: true,
      frequency: 'frequent',
      constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9', '-10^9 <= target <= 10^9'],
      examples: [
        { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 9' },
        { input: 'nums = [3,2,4], target = 6', output: '[1,2]', explanation: 'Because nums[1] + nums[2] == 6' },
      ],
      starterCode: {
        javascript: `function twoSum(nums: number[], target: number): number[] {\n  // Your code here\n}`,
        java: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Your code here\n    }\n}`,
        python: `class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        # Your code here\n`,
      },
      solutionCode: {
        javascript: `function twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (map.has(complement)) {\n      return [map.get(complement), i];\n    }\n    map.set(nums[i], i);\n  }\n  return [];\n}`,
      },
      complexityTime: 'O(n)',
      complexitySpace: 'O(n)',
      tags: ['array', 'hash table'],
    },
    {
      title: 'Reverse Linked List',
      slug: 'reverse-linked-list',
      description: 'Given the head of a singly linked list, reverse the list and return the reversed list.',
      difficulty: 'easy',
      pattern: ['linked_lists'],
      platform: 'leetcode',
      problemId: '206',
      url: 'https://leetcode.com/problems/reverse-linked-list/',
      isInterviewRelevant: true,
      frequency: 'common',
      constraints: ['0 <= number of nodes <= 1000', '-1000 <= Node.val <= 1000'],
      examples: [
        { input: 'head = [1,2,3,4,5]', output: '[5,4,3,2,1]', explanation: 'Reversed linked list' },
        { input: 'head = [1,2]', output: '[2,1]', explanation: 'Reversed linked list' },
      ],
      starterCode: {
        javascript: `function reverseList(head: ListNode | null): ListNode | null {\n  // Your code here\n}`,
        java: `class Solution {\n    public ListNode reverseList(ListNode head) {\n        // Your code here\n    }\n}`,
        python: `class Solution:\n    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:\n        # Your code here\n`,
      },
      solutionCode: {
        javascript: `function reverseList(head) {\n  let prev = null;\n  let current = head;\n  while (current) {\n    const next = current.next;\n    current.next = prev;\n    prev = current;\n    current = next;\n  }\n  return prev;\n}`,
      },
      complexityTime: 'O(n)',
      complexitySpace: 'O(1)',
      tags: ['linked list', 'two pointers'],
    },
    {
      title: 'Longest Substring Without Repeating Characters',
      slug: 'longest-substring-without-repeating-characters',
      description: 'Given a string s, find the length of the longest substring without repeating characters.',
      difficulty: 'medium',
      pattern: ['strings', 'sliding_window'],
      platform: 'leetcode',
      problemId: '3',
      url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/',
      isInterviewRelevant: true,
      frequency: 'common',
      constraints: ['0 <= s.length <= 5 * 10^4', 's consists of English letters, digits, symbols and spaces'],
      examples: [
        { input: 's = "abcabcbb"', output: '3', explanation: 'The answer is "abc", with length 3' },
        { input: 's = "bbbbb"', output: '1', explanation: 'The answer is "b", with length 1' },
      ],
      starterCode: {
        javascript: `function lengthOfLongestSubstring(s: string): number {\n  // Your code here\n}`,
      },
      solutionCode: {
        javascript: `function lengthOfLongestSubstring(s) {\n  let maxLen = 0;\n  let start = 0;\n  const charIndex = new Map();\n  \n  for (let end = 0; end < s.length; end++) {\n    const char = s[end];\n    if (charIndex.has(char) && charIndex.get(char) >= start) {\n      start = charIndex.get(char) + 1;\n    }\n    charIndex.set(char, end);\n    maxLen = Math.max(maxLen, end - start + 1);\n  }\n  \n  return maxLen;\n}`,
      },
      complexityTime: 'O(n)',
      complexitySpace: 'O(min(m, n)) where m is charset size',
      tags: ['string', 'sliding window', 'hash table'],
    },
  ],
};

async function seedTopics() {
  console.log('Seeding topics...');

  for (const topicData of seedData.topics) {
    const existing = await Topic.findOne({ name: topicData.name });

    if (existing) {
      console.log(`  Topic "${topicData.name}" already exists`);
      continue;
    }

    const topic = await Topic.create({
      name: topicData.name,
      description: topicData.description,
      category: topicData.category,
      difficulty: topicData.difficulty,
      interviewPriority: topicData.interviewPriority,
      estimatedStudyHours: topicData.estimatedStudyHours,
      isCore: topicData.isCore,
      tag: topicData.tag,
    });

    console.log(`  Created topic: ${topic.name}`);

    // Create subtopics
    for (const subtopicData of topicData.subtopics) {
      const subtopic = await Subtopic.create({
        name: subtopicData.name,
        description: subtopicData.description,
        topicId: topic._id,
        difficulty: subtopicData.difficulty,
        interviewPriority: 'medium',
        estimatedStudyHours: Math.floor(topicData.estimatedStudyHours / topicData.subtopics.length),
        tag: topicData.tag,
        isCore: subtopicData.isCore,
      });

      topic.subtopics.push(subtopic._id);
      console.log(`    Created subtopic: ${subtopic.name}`);
    }

    await topic.save();
  }

  console.log('Topics seeded successfully!');
}

async function seedQuestions() {
  console.log('Seeding questions...');

  let inserted = 0;
  let skipped = 0;

  for (const questionData of seedData.curatedQuestions) {
    const existing = await Question.findOne({
      question: questionData.question,
      provenance: 'CURATED',
    });

    if (existing) {
      console.log(`  Question already exists: "${questionData.question.substring(0, 50)}..."`);
      skipped++;
      continue;
    }

    const hash = Array.from(questionData.question.toLowerCase().replace(/[^\w\s]/g, ' ').trim())
      .reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0);

    await Question.create({
      ...questionData,
      normalizedHash: `hash_${Math.abs(hash).toString(36)}`,
      version: 1,
      createdAt: new Date(),
    });

    inserted++;
    console.log(`  Created question: "${questionData.question.substring(0, 50)}..."`);
  }

  console.log(`Questions seeded: ${inserted} inserted, ${skipped} skipped`);
}

async function seedCodingProblems() {
  console.log('Seeding coding problems...');

  let inserted = 0;
  let skipped = 0;

  for (const problemData of seedData.codingProblems) {
    const existing = await CodingProblem.findOne({
      platform: problemData.platform,
      problemId: problemData.problemId,
    });

    if (existing) {
      console.log(`  Problem already exists: ${problemData.title}`);
      skipped++;
      continue;
    }

    await CodingProblem.create(problemData);
    inserted++;
    console.log(`  Created problem: ${problemData.title}`);
  }

  console.log(`Coding problems seeded: ${inserted} inserted, ${skipped} skipped`);
}

async function seedAll() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.database.uri, config.database.options);
    console.log('Connected to MongoDB');

    // Seed topics
    await seedTopics();

    // Seed questions
    await seedQuestions();

    // Seed coding problems
    await seedCodingProblems();

    console.log('\n✅ Seeding completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Run seed
seedAll();
