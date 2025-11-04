const { Monarch } = require('./dist/index.cjs');

async function test() {
  console.log('Testing bulk data persistence...');

  const db = new Monarch();
  const collection = db.addCollection('test');

  // Test bulk insert
  const docs = [
    { id: 1, name: 'Test 1' },
    { id: 2, name: 'Test 2' },
    { id: 3, name: 'Test 3' }
  ];

  console.log('Inserting documents...');
  const result = await db.bulkInsert('test', docs);
  console.log('Bulk insert result:', result);

  // Check if data was inserted
  const allDocs = await collection.find({});
  console.log('Found documents:', allDocs.length);
  console.log('Documents:', allDocs);

  process.exit(0);
}

test().catch(console.error);


