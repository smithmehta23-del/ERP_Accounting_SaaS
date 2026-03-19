DROP DATABASE IF EXISTS erp_accounting;
CREATE DATABASE erp_accounting;
USE erp_accounting;

CREATE TABLE companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  base_currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('PREPARER','APPROVER','ADMIN') NOT NULL DEFAULT 'PREPARER',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  account_code VARCHAR(30) NOT NULL,
  account_name VARCHAR(150) NOT NULL,
  account_type ENUM('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE') NOT NULL,
  parent_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_company_account_code (company_id, account_code),
  CONSTRAINT fk_accounts_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_accounts_parent FOREIGN KEY (parent_id) REFERENCES accounts(id)
);

CREATE TABLE voucher_sequence (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  voucher_type VARCHAR(20) NOT NULL,
  prefix VARCHAR(20) NOT NULL,
  next_number INT NOT NULL DEFAULT 1,
  reset_frequency ENUM('NEVER','YEARLY','MONTHLY') NOT NULL DEFAULT 'YEARLY',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_company_vtype (company_id, voucher_type),
  CONSTRAINT fk_vseq_company FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE voucher_header (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  voucher_no VARCHAR(50) NOT NULL UNIQUE,
  voucher_type VARCHAR(20) NOT NULL,
  voucher_date DATE NOT NULL,
  narration VARCHAR(255) NULL,
  status ENUM('DRAFT','PREAPPROVED','APPROVED','CANCELLED','ROLLBACK') NOT NULL DEFAULT 'DRAFT',
  created_by INT NULL,
  approved_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vh_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_vh_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_vh_approved_by FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE voucher_line (
  id INT AUTO_INCREMENT PRIMARY KEY,
  header_id INT NOT NULL,
  line_no INT NOT NULL,
  account_id INT NOT NULL,
  dc ENUM('D','C') NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  line_narration VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vl_header FOREIGN KEY (header_id) REFERENCES voucher_header(id) ON DELETE CASCADE,
  CONSTRAINT fk_vl_account FOREIGN KEY (account_id) REFERENCES accounts(id),
  UNIQUE KEY uq_header_line (header_id, line_no)
);

INSERT INTO companies (code, name, base_currency)
VALUES ('COMP001', 'Demo Company', 'INR');

INSERT INTO users (company_id, full_name, email, password_hash, role, is_active)
VALUES
(1, 'Admin User', 'admin@demo.com', '$2b$10$abcdefghijklmnopqrstuv', 'ADMIN', 1),
(1, 'Preparer User', 'preparer@demo.com', '$2b$10$abcdefghijklmnopqrstuv', 'PREPARER', 1),
(1, 'Approver User', 'approver@demo.com', '$2b$10$abcdefghijklmnopqrstuv', 'APPROVER', 1);

INSERT INTO accounts (company_id, account_code, account_name, account_type, parent_id, is_active)
VALUES
(1, '1000', 'Cash', 'ASSET', NULL, 1),
(1, '1100', 'Bank', 'ASSET', NULL, 1),
(1, '2000', 'Accounts Payable', 'LIABILITY', NULL, 1),
(1, '3000', 'Capital', 'EQUITY', NULL, 1),
(1, '4000', 'Sales', 'INCOME', NULL, 1),
(1, '5000', 'Purchases', 'EXPENSE', NULL, 1);

INSERT INTO voucher_sequence (company_id, voucher_type, prefix, next_number, reset_frequency)
VALUES
(1, 'JV', 'JV', 1, 'YEARLY'),
(1, 'PV', 'PV', 1, 'YEARLY'),
(1, 'RV', 'RV', 1, 'YEARLY');