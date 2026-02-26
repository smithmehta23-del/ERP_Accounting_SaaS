
CREATE VIEW pnl AS
SELECT 'Income' type, SUM(credit-debit) amount FROM gl;
