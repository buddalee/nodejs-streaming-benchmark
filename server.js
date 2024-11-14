const express = require('express');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const app = express();

// 記憶體使用監控
function printMemoryUsage(label) {
    const used = process.memoryUsage();
    console.log(`\n=== ${label} ===`);
    console.log('記憶體使用狀況:');
    for (let key in used) {
        console.log(`${key}: ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
    }
}

// 生成較小的測試資料
app.get('/generate', (req, res) => {
    const size = parseInt(req.query.size) || 10000; // 預設 1 萬筆
    const outputDir = path.join(__dirname, 'test-data');
    const jsonPath = path.join(outputDir, 'test.json');
    const gzipPath = path.join(outputDir, 'test.json.gz');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    // 使用串流寫入 JSON
    const writeStream = fs.createWriteStream(jsonPath);

    writeStream.write('{\n');
    writeStream.write('"id": 1,\n');
    writeStream.write('"name": "測試資料",\n');
    writeStream.write('"items": [\n');

    let count = 0;
    function writeNext() {
        while (count < size) {
            const item = {
                id: count,
                timestamp: new Date().toISOString(),
                data: "測試資料".repeat(10), // 較小的資料量
                numbers: Array(10).fill(0).map(() => Math.random())
            };

            const data = (count === 0 ? '' : ',\n') + JSON.stringify(item);
            if (!writeStream.write(data)) {
                writeStream.once('drain', writeNext);
                return;
            }
            count++;

            if (count % 1000 === 0) {
                console.log(`已生成 ${count} 筆記錄...`);
            }
        }

        writeStream.write('\n]}');
        writeStream.end();
    }

    writeStream.on('finish', () => {
        console.log('JSON 檔案生成完成，開始壓縮...');
        const gzipStream = zlib.createGzip();
        fs.createReadStream(jsonPath)
            .pipe(gzipStream)
            .pipe(fs.createWriteStream(gzipPath))
            .on('finish', () => {
                const jsonSize = fs.statSync(jsonPath).size;
                const gzipSize = fs.statSync(gzipPath).size;
                console.log(`完成！\nJSON 大小: ${(jsonSize/1024/1024).toFixed(2)}MB\nGZip 大小: ${(gzipSize/1024/1024).toFixed(2)}MB`);
                res.json({
                    status: 'ok',
                    message: '測試資料已生成',
                    files: {
                        json: {
                            path: jsonPath,
                            size: jsonSize
                        },
                        gzip: {
                            path: gzipPath,
                            size: gzipSize
                        }
                    }
                });
            });
    });

    writeNext();
});

// 反模式：分批解析
app.post('/bad', express.raw({ limit: '500mb' }), async (req, res) => {
    console.log('\n=== 開始反模式測試 ===');
    printMemoryUsage('初始狀態');
    
    const startTime = process.hrtime();

    try {
        // 解壓縮
        const unzipped = await new Promise((resolve, reject) => {
            zlib.gunzip(req.body, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        printMemoryUsage('解壓縮完成');

        // 計算數據總量
        let totalItems = 0;
        let currentPos = 0;
        const decoder = new TextDecoder();
        const chunkSize = 10 * 1024 * 1024; // 10MB chunks

        while (currentPos < unzipped.length) {
            const chunk = unzipped.slice(currentPos, currentPos + chunkSize);
            const text = decoder.decode(chunk, { stream: true });
            const matches = text.match(/"id":/g);
            if (matches) {
                totalItems += matches.length;
            }
            currentPos += chunkSize;

            if (currentPos % (50 * 1024 * 1024) === 0) { // 每 50MB 記錄一次
                printMemoryUsage(`已處理 ${(currentPos/1024/1024).toFixed(2)}MB`);
            }
        }

        const endTime = process.hrtime(startTime);
        const duration = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);

        printMemoryUsage('處理完成');

        res.json({
            status: 'ok',
            processTime: `${duration}ms`,
            originalSize: req.body.length,
            unzippedSize: unzipped.length,
            approximateItems: totalItems
        });

    } catch (err) {
        console.error('處理錯誤:', err);
        res.status(500).json({
            error: '處理失敗',
            message: err.message
        });
    }
});

// 正確模式：串流處理
app.post('/good', (req, res) => {
    console.log('\n=== 開始串流模式測試 ===');
    printMemoryUsage('初始狀態');
    
    const startTime = process.hrtime();
    const gunzip = zlib.createGunzip();
    let totalItems = 0;
    let processedBytes = 0;
    let dataBuffer = '';

    gunzip.on('data', chunk => {
        processedBytes += chunk.length;
        dataBuffer += chunk.toString();

        // 當緩衝區達到一定大小時處理資料
        if (dataBuffer.length > 1024 * 1024) { // 1MB
            const matches = dataBuffer.match(/"id":/g);
            if (matches) {
                totalItems += matches.length;
            }
            dataBuffer = ''; // 清空緩衝區

            if (processedBytes % (50 * 1024 * 1024) === 0) { // 每 50MB 記錄一次
                printMemoryUsage(`已處理 ${(processedBytes/1024/1024).toFixed(2)}MB`);
            }
        }
    });

    gunzip.on('end', () => {
        // 處理剩餘的資料
        const matches = dataBuffer.match(/"id":/g);
        if (matches) {
            totalItems += matches.length;
        }

        const endTime = process.hrtime(startTime);
        const duration = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);

        printMemoryUsage('處理完成');

        res.json({
            status: 'ok',
            processTime: `${duration}ms`,
            processedBytes,
            approximateItems: totalItems
        });
    });

    req.pipe(gunzip);

    const handleError = (err) => {
        console.error('處理錯誤:', err);
        res.status(500).json({
            error: '處理失敗',
            message: err.message
        });
    };

    req.on('error', handleError);
    gunzip.on('error', handleError);
});

const port = 3000;
app.listen(port, () => {
    console.log(`伺服器運行中: http://localhost:${port}`);
    console.log('\n測試步驟：');
    console.log('1. 生成測試資料 (指定大小）：');
    console.log('   curl "http://localhost:3000/generate?size=10000"');
    console.log('\n2. 測試反模式：');
    console.log('   curl -X POST -H "Content-Type: application/octet-stream" --data-binary @test-data/test.json.gz http://localhost:3000/bad');
    console.log('\n3. 測試串流模式：');
    console.log('   curl -X POST -H "Content-Type: application/octet-stream" --data-binary @test-data/test.json.gz http://localhost:3000/good');
});