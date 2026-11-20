// Field descriptions transcribed from the supplied HTML reference; stored as plain text.
export const IMPORT_FIELD_HELP: Record<string, { web: string; rule: string; error: string }> = {
  "Pattern": {
    "web": "Ký hiệu mẫu số hóa đơn (ô chọn dải)",
    "rule": "Ký hiệu đầy đủ của dải, 7 ký tự, ví dụ 1C26TAA: số 1 là loại hóa đơn GTGT, C có mã, 26 là năm, TAA là ký hiệu. Chỉ cần gửi khi công ty có nhiều dải.",
    "error": "Năm trong ký hiệu (ký tự 3–4) khác năm của ArisingDate thì bị từ chối."
  },
  "Serial": {
    "web": "(ô Ký hiệu, ẩn trên web)",
    "rule": "Theo tài liệu, ký hiệu mẫu số của dải, ví dụ 1. Để trống thì không đưa vào request.",
    "error": ""
  },
  "Ikey": {
    "web": "(không có trên web, chỉ API)",
    "rule": "Khóa tích hợp của hóa đơn, do bên khách hàng đặt, mỗi hóa đơn một khóa. Gọi lại cùng Ikey khi hóa đơn còn là bản nháp thì vẫn trả 200 và cập nhật, không tạo thêm hóa đơn.",
    "error": "Hai hóa đơn trong cùng một gói dùng chung Ikey thì bị báo trùng. Hóa đơn đã phát hành thì không cập nhật được."
  },
  "PaymentMethod": {
    "web": "Hình thức thanh toán (*)",
    "rule": "Bắt buộc, tối đa 50 ký tự. Gửi chữ: Tiền mặt, Chuyển khoản, Tiền mặt/Chuyển khoản, Đối trừ công nợ, Không thu tiền.",
    "error": "Để trống bị từ chối."
  },
  "CusName": {
    "web": "Đơn vị mua",
    "rule": "Tối đa 400 ký tự. Phải có CusName hoặc Buyer (ít nhất một). Có mã số thuế thì bắt buộc cả CusName và CusAddress.",
    "error": "Có CusTaxCode mà thiếu tên hoặc địa chỉ."
  },
  "Buyer": {
    "web": "Tên người mua hàng",
    "rule": "Tối đa 100 ký tự. Dùng cho khách lẻ không có đơn vị.",
    "error": "Không có cả CusName lẫn Buyer."
  },
  "CusTaxCode": {
    "web": "Mã số thuế (nút Lấy thông tin)",
    "rule": "3 dạng hợp lệ: 10 số, 10 số-3 số, hoặc 12 số (CCCD). Có MST thì bắt buộc tên và địa chỉ.",
    "error": "MST sai độ dài hoặc có chữ."
  },
  "CusAddress": {
    "web": "Địa chỉ",
    "rule": "Tối đa 400 ký tự. Bắt buộc khi có mã số thuế.",
    "error": ""
  },
  "ArisingDate": {
    "web": "Ngày tạo lập",
    "rule": "Định dạng dd/MM/yyyy. Để trống thì lấy ngày hôm nay. Năm phải trùng năm trong Pattern.",
    "error": "Thuế 8% mà ngày ngoài thời hạn giảm thuế thì bị từ chối (trừ công ty bật SkipVat8)."
  },
  "CurrencyUnit": {
    "web": "Tiền tệ (ô chọn)",
    "rule": "Bắt buộc, mã 3 ký tự. Web cho chọn 11 loại: VND, USD, EUR, JPY, GBP, SGD, MYR, HKD, KRW, AUD, NOK (công ty có thể cấu hình danh sách riêng). API chỉ kiểm tối đa 3 ký tự, không đối chiếu với danh sách.",
    "error": "Để trống hoặc quá 3 ký tự. Tiền khác VND: nên gửi kèm ExchangeRate."
  },
  "ExchangeRate": {
    "web": "Tỷ giá",
    "rule": "Không bắt buộc (XSD cho phép bỏ trống), là số, tỷ giá quy đổi sang VND. Web luôn có ô này; với VND thì hệ thống hiểu là 1.",
    "error": "Gửi chữ thay vì số sẽ lỗi định dạng XML."
  },
  "Total": {
    "web": "Tổng tiền trước thuế",
    "rule": "Tổng Total của các dòng hàng. Hệ thống không tự đối chiếu với tổng các dòng; sandbox chỉ cảnh báo khi lệch.",
    "error": "Lệch tổng dòng làm CQT có thể từ chối khi phát hành."
  },
  "VATAmount": {
    "web": "Tổng tiền thuế",
    "rule": "Tổng thuế của hóa đơn. Hệ thống không kiểm khớp với các dòng.",
    "error": ""
  },
  "VATRate": {
    "web": "Thuế GTGT (ô chọn)",
    "rule": "Mã thuế suất: 0, 5, 8, 10, -1 (không chịu thuế), -2 (không kê khai), -3 (thuế khác), -5 (cho thuê tài chính), -6, -7. Mẫu một thuế suất khai ở đây, mọi dòng lấy theo.",
    "error": "Hóa đơn và dòng đều không có VATRate thì lỗi 500. Chọn -5 thì dòng cũng phải -5."
  },
  "VATRateOther": {
    "web": "Ô nhập giá trị khi chọn KHAC",
    "rule": "Chỉ dùng khi thuế suất là -3. Giá trị 0–99.99, tối đa 2 số lẻ.",
    "error": "Chọn -3 mà thiếu hoặc ngoài khoảng 0–99.99."
  },
  "Amount": {
    "web": "Tổng tiền dịch vụ",
    "rule": "Bắt buộc. Bằng Total + VATAmount.",
    "error": "Lệch công thức: hệ thống không chặn nhưng CQT có thể từ chối."
  },
  "AmountInWords": {
    "web": "Số tiền viết bằng chữ",
    "rule": "Bắt buộc, tối đa 255 ký tự. Web tự đọc từ tổng tiền, API thì bạn phải tự gửi. Đọc theo Amount, ví dụ 110000 → \"Một trăm mười nghìn đồng chẵn\". Bấm nút Điền theo Amount để sandbox đọc giúp.",
    "error": "Để trống bị từ chối. Chữ không khớp Amount: hệ thống không chặn nhưng hóa đơn sai thông tin khi phát hành."
  },
  "ListAttachNum": {
    "web": "Số bảng kê (trong khối \"Nhập thông tin trường mở rộng\")",
    "rule": "Bắt buộc, cùng ListAttachDate, khi hóa đơn có chiết khấu lớn hơn hàng hóa (tổng tiền âm).",
    "error": ""
  },
  "ListAttachDate": {
    "web": "Ngày bảng kê",
    "rule": "Định dạng dd/MM/yyyy, đi cùng số bảng kê.",
    "error": ""
  },
  "LocationCode": {
    "web": "Mã địa điểm kinh doanh",
    "rule": "Không bắt buộc, tối đa 5 ký tự. Cả ba trường địa điểm trống thì hệ thống tự điền theo cấu hình công ty.",
    "error": "Quá 5 ký tự."
  },
  "P.No": {
    "web": "STT",
    "rule": "Số thứ tự dòng.",
    "error": ""
  },
  "P.Feature": {
    "web": "Tính chất: HH,DV · KM · CK · Ghi chú · HHĐT",
    "rule": "1 hàng hóa, 2 khuyến mại, 3 chiết khấu thương mại (hệ thống đổi tiền của dòng thành số âm), 4 ghi chú, 5 hàng hóa đặc trưng. Dòng 2 và 4 không cộng vào tổng.",
    "error": "Dòng chiết khấu lớn hơn tổng hàng bị chặn."
  },
  "P.ProdName": {
    "web": "Tên hàng hóa, dịch vụ",
    "rule": "Bắt buộc, tối đa 500 ký tự.",
    "error": "Để trống."
  },
  "P.Total": {
    "web": "Thành tiền",
    "rule": "Bắt buộc. Tiền hàng của dòng, chưa thuế.",
    "error": ""
  },
  "P.VATAmount": {
    "web": "Thuế GTGT của dòng (ẩn trên web)",
    "rule": "Không gửi thì hệ thống tự tính = Total × thuế suất hóa đơn ÷ 100, nhưng chỉ khi dòng không gửi Feature.",
    "error": "Dòng có Feature mà không gửi VATAmount thì thuế lưu 0."
  },
  "P.Amount": {
    "web": "Cộng (ẩn trên web)",
    "rule": "Bắt buộc. = Total + VATAmount của dòng.",
    "error": ""
  }
};
