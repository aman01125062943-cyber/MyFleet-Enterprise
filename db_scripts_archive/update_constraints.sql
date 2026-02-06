
-- إصلاح قيد الحذف: عند حذف سيارة، احذف جميع معاملاتها المالية تلقائياً
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS transactions_car_id_fkey;

ALTER TABLE transactions 
ADD CONSTRAINT transactions_car_id_fkey 
FOREIGN KEY (car_id) 
REFERENCES cars(id) 
ON DELETE CASCADE;

-- تحسينات إضافية للأداء عند البحث بالتواريخ
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_car_id ON transactions(car_id);
