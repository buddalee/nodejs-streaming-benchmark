# Node.js IO Streaming Benchmark

This repository demonstrates the performance difference between streaming and non-streaming approaches when handling large HTTP requests with compression in Node.js.

## 📚 Educational Materials

This repository contains two important supplementary documents:

1. [Original Article](./originArticle.md) - A practical explanation of I/O streaming importance in modern web applications, originally from a RDBMS course.

2. [Computer Science Theory](./cs.md) - A comprehensive academic supplement covering the computer science fundamentals behind I/O streaming, including:
   - Memory Hierarchy
   - Buffer Management
   - Cache Optimization
   - Performance Analysis
   - Practical Experiments

## 🎯 Purpose

To illustrate why streaming is crucial for handling large data efficiently, especially in high-performance web services. This benchmark specifically compares:

- Memory usage patterns
- CPU cache efficiency
- Processing large compressed JSON data
- Handling large HTTP request bodies

## 🔍 Key Findings

### Memory Usage Comparison

Non-Streaming (Bad Pattern):
```
Initial State:
- RSS: 288.56 MB
- Heap Used: 6.24 MB
- External: 244.32 MB
- Array Buffers: 242.42 MB

Peak Usage:
- RSS: 1305.25 MB
- Heap Used: ~14 MB
- External: ~1.5 GB
- Array Buffers: 1469.56 MB
```

Streaming (Good Pattern):
```
Initial State:
- RSS: 238.27 MB
- Heap Used: 5.71 MB
- External: 1.91 MB
- Array Buffers: 0.02 MB

Peak Usage:
- RSS: 243.52 MB
- Heap Used: 9.58 MB
- External: 2.39 MB
- Array Buffers: 0.5 MB
```

Key Differences:
- Memory Usage: ~5.4x reduction
- External Memory: ~625x reduction
- Stable memory footprint in streaming mode

## 🛠 Setup

1. Install dependencies:
```bash
npm install express
```

2. Run the server:
```bash
node server.js
```

## 🧪 Running Tests

1. Generate test data:
```bash
curl "http://localhost:3000/generate?size=10000"
```

2. Test non-streaming approach:
```bash
curl -X POST \
     -H "Content-Type: application/octet-stream" \
     --data-binary @test-data/test.json.gz \
     http://localhost:3000/bad
```

3. Test streaming approach:
```bash
curl -X POST \
     -H "Content-Type: application/octet-stream" \
     --data-binary @test-data/test.json.gz \
     http://localhost:3000/good
```

## 💡 Key Implementation Points

### Non-Streaming Approach (Bad Pattern)
```javascript
// Loads entire request into memory
const buffer = Buffer.from(req.body);
    
// Decompresses entire data at once
zlib.gunzip(buffer, (err, unzipped) => {
    // Process entire unzipped data
});
```

### Streaming Approach (Good Pattern)
```javascript
const gunzip = zlib.createGunzip();
let processedBytes = 0;
let dataBuffer = '';

gunzip.on('data', chunk => {
    processedBytes += chunk.length;
    // Process data in chunks
});

req.pipe(gunzip);
```

## 🔬 Monitoring Metrics

The benchmark tracks:
- RSS (Resident Set Size)
- Heap Usage
- External Memory
- Array Buffers
- Processing Time
- Data Throughput

## 🎯 Real-world Implications

1. Server Capacity
   - Higher concurrent request handling
   - More stable memory usage
   - Better resource utilization

2. Performance
   - Improved CPU cache utilization
   - Reduced garbage collection overhead
   - Better response times under load

3. Security
   - Natural protection against zip bombs
   - More predictable resource usage
   - Better DoS resistance

## 📚 Further Reading

- [Node.js Streams Documentation](https://nodejs.org/api/stream.html)
- [Express.js Documentation](https://expressjs.com/)
- [Node.js Buffer Documentation](https://nodejs.org/api/buffer.html)
- [Node.js zlib Documentation](https://nodejs.org/api/zlib.html)

## 🤝 Contributing

Feel free to contribute by:
1. Opening issues
2. Submitting pull requests
3. Improving documentation
4. Adding more test cases

## 🎓 Academic Use

This repository is designed to be useful for both industry practitioners and academic purposes. The included materials can be particularly valuable for:

- Computer Science students studying I/O operations
- Software Engineering courses covering performance optimization
- System Design courses discussing scalability
- Database courses exploring I/O efficiency

## 📄 License

MIT

## 🙏 Acknowledgments

This benchmark and its educational materials are inspired by RDBMS course materials about I/O streaming in modern web applications, with additional computer science theoretical foundations provided for academic purposes.