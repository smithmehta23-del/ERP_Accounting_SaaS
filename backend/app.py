from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector

app = Flask(__name__)
CORS(app)

db = mysql.connector.connect(
    host="localhost",
    user="erpuser",
    password="erp123",
    database="erp_accounting"
)

@app.route("/")
def home():
    return "ERP Backend Running ✅"

@app.route("/add-invoice", methods=["POST"])
def add_invoice():
    data = request.json
    cursor = db.cursor()

    sql = """
        INSERT INTO supplier_invoice 
        (supplier_name, invoice_date, amount, status)
        VALUES (%s, %s, %s, %s)
    """

    values = (
        data["supplier_name"],
        data["invoice_date"],
        data["amount"],
        "Pending"
    )

    cursor.execute(sql, values)
    db.commit()

    return jsonify({"message": "Invoice Saved Successfully ✅"})

if __name__ == "__main__":
    app.run(debug=True)
