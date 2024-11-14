# I/O Streaming 最佳實踐 - RDBMS 課程筆記

## 前言
在 RDBMS 課程教學過程中，發現許多學生對 I/O streaming 的概念和應用並不熟悉。這份內容旨在說明 I/O streaming 的重要性和正確使用方式。

## I/O Streaming 的重要性：以影片串流為例

### 反模式示例
一個常見的 I/O 相關反模式：
> "我想看 8 小時 4K 的動作大片，即使只看一次也好我也整套下載下來塞爆我的 HDD"

讓我們來計算一下：
- 8 小時 4K 影片 ≈ 0.8 GB/hour × 8 hours × 3600 seconds = 23GB
- 這對手機存儲空間來說是個巨大的負擔

### 正確的串流處理方式
影片串流網站的運作方式：

1. **緩衝區配置**
   - Browser/App 會配置固定大小（如 128 MB）的記憶體作為 buffer

2. **資料傳輸**
   - 當 buffer 未滿時，OS 會要求網站傳送更多資料
   - 注意：實際的 buffer 機制比這複雜得多，這裡是簡化說明

3. **資料處理**
   - 應用程式從 buffer 取得資料
   - 進行 H265 解壓縮
   - 顯示到畫面上

關鍵點：
> 即使處理 23GB 的影片，也只會使用固定大小的記憶體！

## HTTP Request Body 處理的最佳實踐

### 常見的錯誤處理方式
```go
// 反模式
reqBodyData := ioutil.ReadAll(req.Body)
unzippedData := gzip.Unzip(reqBodyData)
json.deserialize(unzippedData, *obj)
```

問題分析：
1. **記憶體浪費**
   - 100KB gzipped JSON → 解壓後 1MB
   - 每個請求佔用 1.1MB 記憶體
   - 1000 RPS → 每秒浪費 1.1GB 記憶體

2. **CPU Cache 效率低下**
   - 大量記憶體使用降低 CPU cache hit rate
   - 同樣的 CPU 使用率下效能更差

3. **安全隱患**
   - 無法應對 zip bomb 攻擊
   - 可能導致系統記憶體耗盡

### 正確的實現方式
```go
// 正確模式
unzippedDataReader := new gzip.UnzipReader(req.Body)
json.deserialize(unzippedDataReader, *obj)
```

`ReadData` 方法的實現邏輯：
```go
func (r *UnzipReader) ReadData(n int) []byte {
    while (this.buffer.size >= n) {
        Get Data from req.Body
        perform unzip and add into buffer
    }
    return data from buffer
}
```

優勢：
1. **記憶體效率**
   - 使用固定且少量的記憶體
   - 降低 GC 壓力
   - 防止 zip bomb 攻擊

2. **CPU 效率**
   - 資料停留在小型 buffer
   - 提高 CPU cache 命中率
   - 整體性能更好

## 工程實踐建議

1. **使用現有解決方案**
   - 大多數 backend framework 已內建處理機制
   - 優先使用經過測試的函式庫

2. **串流處理原則**
   - 單次使用的資料採用串流處理
   - 多階段處理使用 Reader/Writer 串接
   - 避免中間階段儲存完整資料

## 結論

1. 串流處理的效能優勢是數量級的
2. 高效程式設計需要：
   - 理解基礎原理
   - 注重實現細節
   - 避免過度工程

> 寫出高效能的程式並不難，關鍵在於願意學習和重視基礎工程素養。

---
*註：本內容來自 2024 年 RDBMS 課程*