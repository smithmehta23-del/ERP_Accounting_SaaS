import mysql.connector

def get_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="252999@Ajay",
        database="erp_accounting"
    )
