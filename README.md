# Cấu hình Softdreams

Sửa ba biến trong `.env.local` tại thư mục gốc:

- `SOFTDREAMS_BASE_URL`: domain gốc, không kèm path API.
- `SOFTDREAMS_USERNAME`: tài khoản API.
- `SOFTDREAMS_PASSWORD`: mật khẩu API.

Giữ password trong dấu nháy kép. Ký tự dollar phải viết thành `\$`
vì Next.js hỗ trợ mở rộng biến môi trường. Dấu # trong password cần nằm trong dấu nháy.
Sau khi đổi, khởi động lại ứng dụng và tải lại trang.

`.env.local` được Git bỏ qua. Khi cài mới, sao chép `.env.example`
thành `.env.local` và điền tài khoản thật. Khi deploy, cấu hình cùng ba biến
trên hosting rồi restart/redeploy. Trên hosting nhập password nguyên bản,
không thêm dấu nháy hoặc escape dành cho file dotenv.

Domain hiển thị trên form được server đọc tại thời điểm truy cập.
Credential chỉ được đọc phía server. Path/method từng API nằm trong
`lib/softdreams/endpoints.ts`.

Chạy kiểm tra bằng `node tests/import-invoice.cjs`; test dùng cấu hình giả
và response giả lập, không gửi request lên Softdreams.

## Quy tắc form importInvoice

Đối chiếu tài liệu phân tích code ngày 19/11/2026:
`H:\work\easyinvoice-admin\docs\importInvoice_validate.md`.

- Form hỗ trợ TT78 C78InvoiceVAT và biên lai Receipt. Mẫu cũ, chứng từ TNCN,
  PXK không tự chuyển đổi bằng lựa chọn này.
- Profile và loại hàng hóa đặc trưng chỉ dùng kiểm tra cục bộ; không được gửi
  thành thẻ XML và không thay đổi cấu hình mẫu/dải trên Softdreams.
- Pattern/Serial và ngày có thể để trống. AmountInWords luôn có thẻ.
- Thuế suất: -7, -6, -5, -3, -2, -1, 0, 5, 8, 10. Thuế -3 cần VATRateOther.
- Không gửi BusinessProdGroupCode thành thẻ hoặc bộ Gross. Cho phép Extra chuỗi
  thường; Feature 5 cần JSON đúng loại đặc trưng.
- Tính tiền trên form chỉ là gợi ý dùng chung với XML builder; cho phép nhập tiền
  riêng từng dòng/tổng. Không chặn chỉ vì SL × ĐG khác thành tiền.
  Discount (%) và DiscountAmount là hai giá trị riêng, không tự áp trùng.
- Áp quy tắc trường TT78 mặc định. Không tự đọc được NotValidateXmlData,
  NotDiscountForm, cleaner AmountInWords, cấu hình CheckVat8, danh mục tỉnh/xã,
  trạng thái Ikey hoặc quyền tài khoản. Các ngoại lệ theo cấu hình công ty vẫn
  cần kiểm chứng trên API. Convert/updateCus được gửi ở JSON ngoài cùng.
