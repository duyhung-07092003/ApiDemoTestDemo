"use client";

import { ChevronDown } from "lucide-react";
import type { CompanySimulation } from "@/lib/softdreams/company-preview";

export function CompanySimulationSettings({ simulation, onSimulationChange }: { simulation: CompanySimulation; onSimulationChange: (value: CompanySimulation) => void }) {
  return (
    <details className="import-company-config import-config-disclosure">
      <summary><span><strong>Giả lập cấu hình công ty</strong><small>Các tùy chọn mô phỏng dùng chung cho cả gói</small></span><ChevronDown size={17} /></summary>
      <div className="import-config-body">
      <p>Các tùy chọn này là cấu hình riêng của công ty bạn (công ty tự bật trên hệ thống), không gửi trong request. Bật để xem sandbox phản ứng thế nào.</p>
      <label className="import-inline-check"><input type="checkbox" checked={simulation.notValidate} onChange={(event) => onSimulationChange({ ...simulation, notValidate: event.target.checked })} /><span>Công ty bật <code>NotValidateXmlData</code> (bỏ qua kiểm tra trường và sản phẩm; vẫn kiểm XSD, Ikey, chiết khấu, năm ký hiệu, thuế 8%)<small>Ví dụ: bỏ trống cả CusName lẫn Buyer để so sánh kết quả mô phỏng khi bật/tắt.</small></span></label>
      <label className="import-inline-check"><input type="checkbox" checked={simulation.skipVat8} onChange={(event) => onSimulationChange({ ...simulation, skipVat8: event.target.checked })} /><span>Công ty bật <code>SkipVat8=1</code> (bỏ qua kiểm thuế 8% theo thời hạn giảm thuế; chỉ áp dụng ký hiệu bắt đầu 1, 2, 5)<small>Ví dụ trong HTML: chọn thuế 8% và ngày năm 2027 để so sánh khi bật/tắt. Thời hạn thực tế phụ thuộc CheckVat8 trên server.</small></span></label>
      <p className="import-full-note">Các công tắc chỉ mô phỏng; không tự bật cấu hình trên Softdreams. Gửi thật vẫn được server kiểm tra dữ liệu. Thời hạn thuế 8% cần đối chiếu cấu hình công ty.</p>
      </div>
    </details>
  );
}
