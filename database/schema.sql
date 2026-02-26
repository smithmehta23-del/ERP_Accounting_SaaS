
CREATE TABLE company(
 id INT AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(200),
 gst VARCHAR(20),
 pan VARCHAR(20),
 base_currency VARCHAR(10)
);

CREATE TABLE voucher_header(
 id INT AUTO_INCREMENT PRIMARY KEY,
 voucher_no VARCHAR(20),
 status ENUM('PREAPPROVED','APPROVED','CANCELLED'),
 voucher_date DATE
);

CREATE TABLE voucher_line(
 id INT AUTO_INCREMENT PRIMARY KEY,
 voucher_id INT,
 taxable_amount DECIMAL(15,2),
 tax_amount DECIMAL(15,2)
);
