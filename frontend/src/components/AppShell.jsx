import React, { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    BookOpen,
    Receipt,
    FileBarChart2,
    FileText,
    CheckCircle2,
    Landmark,
    Search,
    Bell,
    Plus,
    LogOut,
    Users,
    Building2,
    Scale,
    MessageCircle,
    X,
    Send,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { clearAuth, getUser } from "../auth";
import API from "../api";

const styles = {
    page: {
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
    },
    layout: (collapsed) => ({
        display: "grid",
        gridTemplateColumns: collapsed ? "92px 1fr" : "270px 1fr",
        minHeight: "100vh",
        transition: "grid-template-columns 0.2s ease",
    }),
    sidebar: {
        background: "#ffffff",
        borderRight: "1px solid #e2e8f0",
        padding: "20px 12px",
        position: "relative",
    },
    collapseBtn: {
        position: "absolute",
        top: 18,
        right: 10,
        width: 30,
        height: 30,
        borderRadius: 999,
        border: "1px solid #e2e8f0",
        background: "#fff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    brand: (collapsed) => ({
        display: "flex",
        alignItems: "center",
        gap: 12,
        paddingBottom: 18,
        borderBottom: "1px solid #e2e8f0",
        marginBottom: 18,
        justifyContent: collapsed ? "center" : "flex-start",
        paddingRight: collapsed ? 0 : 26,
    }),
    brandIcon: {
        width: 44,
        height: 44,
        borderRadius: 16,
        background: "#0f172a",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    sectionLabel: (collapsed) => ({
        fontSize: 11,
        color: "#94a3b8",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        margin: collapsed ? "14px 0 8px" : "14px 8px 8px",
        textAlign: collapsed ? "center" : "left",
    }),
    link: (isActive, collapsed) => ({
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: 10,
        padding: collapsed ? "12px 10px" : "12px 14px",
        borderRadius: 16,
        marginBottom: 8,
        textDecoration: "none",
        background: isActive ? "#0f172a" : "transparent",
        color: isActive ? "#fff" : "#475569",
        fontSize: 14,
        fontWeight: 600,
    }),
    moreToggle: (collapsed) => ({
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        gap: 10,
        padding: collapsed ? "12px 10px" : "12px 14px",
        borderRadius: 16,
        marginBottom: 8,
        background: "#f8fafc",
        color: "#475569",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        border: "1px solid #e2e8f0",
    }),
    main: {
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
    },
    header: {
        background: "rgba(255,255,255,0.96)",
        borderBottom: "1px solid #e2e8f0",
        padding: "18px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 700,
        margin: 0,
    },
    headerSub: {
        marginTop: 6,
        fontSize: 14,
        color: "#64748b",
    },
    topActions: {
        display: "flex",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap",
    },
    searchWrap: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#fff",
        border: "1px solid #cbd5e1",
        borderRadius: 16,
        padding: "10px 12px",
        minWidth: 360,
        boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
    },
    input: {
        border: "none",
        outline: "none",
        width: "100%",
        fontSize: 14,
        background: "transparent",
    },
    btn: {
        background: "#0f172a",
        color: "#fff",
        border: "none",
        borderRadius: 16,
        padding: "11px 16px",
        fontWeight: 600,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
    },
    outlineBtn: {
        background: "#fff",
        color: "#0f172a",
        border: "1px solid #cbd5e1",
        borderRadius: 16,
        padding: "11px 16px",
        fontWeight: 600,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
    },
    content: {
        padding: 24,
    },
    footerUser: (collapsed) => ({
        marginTop: 18,
        paddingTop: 18,
        borderTop: "1px solid #e2e8f0",
        textAlign: collapsed ? "center" : "left",
    }),
    floatingBtn: {
        position: "fixed",
        right: 24,
        bottom: 24,
        width: 58,
        height: 58,
        borderRadius: "50%",
        background: "#0f172a",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        boxShadow: "0 10px 30px rgba(15,23,42,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
    },
    assistantPanel: {
        position: "fixed",
        right: 24,
        bottom: 94,
        width: 390,
        maxWidth: "calc(100vw - 32px)",
        height: 560,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 24,
        boxShadow: "0 20px 60px rgba(15,23,42,0.20)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 2000,
    },
    assistantHeader: {
        padding: "16px 18px",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    assistantBody: {
        flex: 1,
        overflowY: "auto",
        background: "#f8fafc",
        padding: 16,
    },
    msgWrap: {
        display: "flex",
        marginBottom: 12,
    },
    msg: (role) => ({
        maxWidth: "85%",
        padding: "10px 12px",
        borderRadius: 16,
        background: role === "user" ? "#0f172a" : "#fff",
        color: role === "user" ? "#fff" : "#0f172a",
        border: role === "user" ? "none" : "1px solid #e2e8f0",
        marginLeft: role === "user" ? "auto" : 0,
        whiteSpace: "pre-wrap",
        lineHeight: 1.5,
        fontSize: 14,
    }),
    assistantFooter: {
        borderTop: "1px solid #e2e8f0",
        padding: 12,
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
    },
    assistantInput: {
        flex: 1,
        minHeight: 46,
        maxHeight: 120,
        border: "1px solid #cbd5e1",
        borderRadius: 14,
        padding: "10px 12px",
        fontSize: 14,
        resize: "vertical",
        boxSizing: "border-box",
    },
    quickRow: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        padding: "0 16px 12px",
        borderTop: "1px solid #e2e8f0",
        background: "#fff",
    },
    quickChip: {
        border: "1px solid #cbd5e1",
        background: "#fff",
        borderRadius: 999,
        padding: "8px 10px",
        fontSize: 12,
        cursor: "pointer",
    },
};

function AppShell({ children }) {
    const user = getUser();
    const role = String(user?.role || "").toUpperCase();
    const navigate = useNavigate();
    const location = useLocation();

    const [collapsed, setCollapsed] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [assistantOpen, setAssistantOpen] = useState(false);
    const [assistantInput, setAssistantInput] = useState("");
    const [assistantLoading, setAssistantLoading] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content:
                "Hi, I’m your ERP AI assistant.\nI can guide you with vouchers, invoices, bank reconciliation, reports, and ERP summaries.",
        },
    ]);

    const nav = [
        { label: "Dashboard", to: "/", icon: LayoutDashboard, roles: ["ADMIN", "PREPARER", "APPROVER"], section: "Overview" },

        { label: "Invoices", to: "/invoices", icon: Receipt, roles: ["ADMIN", "PREPARER"], section: "Transactions" },
        { label: "Sales Orders", to: "/sales-orders", icon: FileText, roles: ["ADMIN", "PREPARER", "APPROVER"], section: "Transactions" },
        { label: "Purchase Orders", to: "/purchase-orders", icon: FileText, roles: ["ADMIN", "PREPARER", "APPROVER"], section: "Transactions" },
        { label: "Vouchers", to: "/vouchers", icon: Receipt, roles: ["ADMIN", "PREPARER", "APPROVER"], section: "Transactions" },
        { label: "Approvals", to: "/approvals", icon: CheckCircle2, roles: ["ADMIN", "APPROVER"], section: "Transactions" },
        { label: "Bank Reconciliation", to: "/bank-reconciliation", icon: Landmark, roles: ["ADMIN", "APPROVER"], section: "Transactions" },
        { label: "Receivables", to: "/receivables", icon: FileBarChart2, roles: ["ADMIN", "PREPARER", "APPROVER"], section: "Transactions" },
        { label: "Payables", to: "/payables", icon: FileBarChart2, roles: ["ADMIN", "PREPARER", "APPROVER"], section: "Transactions" },

        { label: "Parties", to: "/parties", icon: Users, roles: ["ADMIN", "PREPARER"], section: "Masters" },
        { label: "Items", to: "/items", icon: BookOpen, roles: ["ADMIN", "PREPARER"], section: "Masters" },
        { label: "Chart of Accounts", to: "/accounts", icon: BookOpen, roles: ["ADMIN"], section: "Masters" },

        { label: "Trial Balance", to: "/reports", icon: FileBarChart2, roles: ["ADMIN", "PREPARER", "APPROVER"], section: "Reports" },
        { label: "P&L", to: "/reports/pnl", icon: FileBarChart2, roles: ["ADMIN", "PREPARER", "APPROVER"], section: "Reports" },
        { label: "Balance Sheet", to: "/reports/balance-sheet", icon: Scale, roles: ["ADMIN", "PREPARER", "APPROVER"], section: "Reports" },
        { label: "Stock Summary", to: "/reports/stock-summary", icon: FileBarChart2, roles: ["ADMIN", "PREPARER", "APPROVER"], section: "Reports" },

        { label: "Settings", to: "/settings", icon: BookOpen, roles: ["ADMIN"], section: "More" },
        { label: "Audit Log", to: "/audit-log", icon: FileBarChart2, roles: ["ADMIN", "APPROVER"], section: "More" },
        { label: "Period Close", to: "/period-close", icon: BookOpen, roles: ["ADMIN"], section: "More" },
    ].filter((item) => item.roles.includes(role));

    const mainNav = useMemo(
        () => nav.filter((item) => item.section !== "More"),
        [nav]
    );

    const moreNav = useMemo(
        () => nav.filter((item) => item.section === "More"),
        [nav]
    );

    const groupedNav = mainNav.reduce((acc, item) => {
        if (!acc[item.section]) acc[item.section] = [];
        acc[item.section].push(item);
        return acc;
    }, {});

    const logout = () => {
        clearAuth();
        window.location.href = "/login";
    };

    const titleMap = {
        "/": "Dashboard",
        "/accounts": "Chart of Accounts",
        "/parties": "Party Master",
        "/ledger": "General Ledger",
        "/vouchers": "Voucher Management",
        "/reports": "Trial Balance",
        "/reports/pnl": "Profit & Loss",
        "/reports/balance-sheet": "Balance Sheet",
        "/approvals": "Approval Workflow",
        "/bank-reconciliation": "Bank Reconciliation",
        "/reports/ar-aging": "A/R Aging",
        "/reports/ap-aging": "A/P Aging",
        "/reports/gst": "GST Reports",
        "/settlements": "Invoice Settlements",
        "/settings": "Accounting Settings",
        "/period-close": "Month-End Closing",
        "/audit-log": "Audit Log",
        "/items": "Item Master",
        "/reports/stock-summary": "Stock Summary",
        "/reports/stock-ledger": "Stock Ledger",
        "/reports/item-sales-register": "Item Sales Register",
        "/reports/item-purchase-register": "Item Purchase Register",
        "/reports/low-stock": "Low Stock Alerts",
        "/reports/reorder-suggestions": "Reorder Suggestions",
        "/sales-orders": "Sales Orders",
        "/purchase-orders": "Purchase Orders",
        "/receivables": "Receivables",
        "/payables": "Payables",
        "/party-ledger": "Party Ledger",
        "/collections": "Collections Dashboard",
        "/followups": "Collections Follow-ups",
        "/financial-years": "Financial Years",
        "/posting-locks": "Posting Locks",
        "/company-switcher": "Company Switcher",
    };

    const runInternalSearch = async (query) => {
        const q = String(query || "").trim().toLowerCase();
        if (!q) return;

        if (q.includes("dashboard")) return navigate("/");
        if (q.includes("voucher")) return navigate("/vouchers");
        if (q.includes("invoice")) return navigate("/invoices");
        if (q.includes("sales order")) return navigate("/sales-orders");
        if (q.includes("purchase order")) return navigate("/purchase-orders");
        if (q.includes("party")) return navigate("/parties");
        if (q.includes("account")) return navigate("/accounts");
        if (q.includes("item")) return navigate("/items");
        if (q.includes("ledger")) return navigate("/ledger");
        if (q.includes("trial")) return navigate("/reports");
        if (q.includes("profit") || q.includes("p&l")) return navigate("/reports/pnl");
        if (q.includes("balance sheet")) return navigate("/reports/balance-sheet");
        if (q.includes("receivable")) return navigate("/receivables");
        if (q.includes("payable")) return navigate("/payables");
        if (q.includes("approval")) return navigate("/approvals");
        if (q.includes("settlement")) return navigate("/settlements");
        if (q.includes("bank")) return navigate("/bank-reconciliation");
        if (q.includes("gst")) return navigate("/reports/gst");
        if (q.includes("stock")) return navigate("/reports/stock-summary");

        try {
            const res = await API.post("/search/internal", { query: q });
            const data = res.data || {};

            if (data.route) {
                navigate(data.route);
                return;
            }

            if (data.message) {
                alert(data.message);
                return;
            }
        } catch (error) {
            console.error(error);
        }

        alert("No matching record or screen found.");
    };

    const submitSearch = (e) => {
        e.preventDefault();
        runInternalSearch(searchQuery);
    };

    const sendAssistantMessage = async (forcedText) => {
        const text = String(forcedText ?? assistantInput).trim();
        if (!text || assistantLoading) return;

        const nextMessages = [...messages, { role: "user", content: text }];
        setMessages(nextMessages);
        setAssistantInput("");
        setAssistantLoading(true);

        try {
            const res = await API.post("/ai/assistant/chat", {
                message: text,
                history: nextMessages,
            });

            const data = res.data || {};

            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: data.reply || "Done." },
            ]);

            if (data.route) {
                setTimeout(() => navigate(data.route), 500);
            }
        } catch (error) {
            console.error(error);
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content:
                        error?.response?.data?.message ||
                        "Sorry, I could not process that request.",
                },
            ]);
        } finally {
            setAssistantLoading(false);
        }
    };

    return (
        <div style={styles.page}>
            <div style={styles.layout(collapsed)}>
                <aside style={styles.sidebar}>
                    <button
                        style={styles.collapseBtn}
                        onClick={() => setCollapsed((prev) => !prev)}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>

                    <div style={styles.brand(collapsed)}>
                        <div style={styles.brandIcon}>
                            <Landmark size={20} />
                        </div>
                        {!collapsed ? (
                            <div>
                                <div style={{ fontWeight: 700 }}>ERP Accounting</div>
                                <div style={{ fontSize: 12, color: "#64748b" }}>Finance Control Center</div>
                            </div>
                        ) : null}
                    </div>

                    <div>
                        {Object.entries(groupedNav).map(([section, items]) => (
                            <div key={section}>
                                <div style={styles.sectionLabel(collapsed)}>
                                    {collapsed ? section.charAt(0) : section}
                                </div>
                                {items.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <NavLink key={item.to} to={item.to} end={item.to === "/"}>
                                            {({ isActive }) => (
                                                <div style={styles.link(isActive, collapsed)} title={item.label}>
                                                    <Icon size={16} />
                                                    {!collapsed ? <span>{item.label}</span> : null}
                                                </div>
                                            )}
                                        </NavLink>
                                    );
                                })}
                            </div>
                        ))}

                        {moreNav.length ? (
                            <div>
                                <div style={styles.sectionLabel(collapsed)}>
                                    {collapsed ? "M" : "More"}
                                </div>

                                <div
                                    style={styles.moreToggle(collapsed)}
                                    onClick={() => setMoreOpen((prev) => !prev)}
                                    title="Toggle more options"
                                >
                                    {!collapsed ? <span>More Options</span> : null}
                                    {moreOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                                </div>

                                {moreOpen
                                    ? moreNav.map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <NavLink key={item.to} to={item.to} end={item.to === "/"}>
                                                {({ isActive }) => (
                                                    <div style={styles.link(isActive, collapsed)} title={item.label}>
                                                        <Icon size={16} />
                                                        {!collapsed ? <span>{item.label}</span> : null}
                                                    </div>
                                                )}
                                            </NavLink>
                                        );
                                    })
                                    : null}
                            </div>
                        ) : null}
                    </div>

                    <div style={styles.footerUser(collapsed)}>
                        {!collapsed ? (
                            <>
                                <div style={{ fontSize: 13, color: "#64748b" }}>Logged in as</div>
                                <div style={{ fontWeight: 700, marginTop: 4 }}>{user?.name || "-"}</div>
                                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{role}</div>
                            </>
                        ) : (
                            <div style={{ fontSize: 12, color: "#64748b" }}>{role}</div>
                        )}

                        <button
                            style={{ ...styles.outlineBtn, width: "100%", marginTop: 14, justifyContent: "center" }}
                            onClick={logout}
                            title="Logout"
                        >
                            <LogOut size={16} />
                            {!collapsed ? "Logout" : null}
                        </button>
                    </div>
                </aside>

                <main style={styles.main}>
                    <header style={styles.header}>
                        <div>
                            <h1 style={styles.headerTitle}>
                                {titleMap[location.pathname] || "ERP Accounting"}
                            </h1>
                            <div style={styles.headerSub}>
                                Professional finance operations, approvals, reports, and AI assistance.
                            </div>
                        </div>

                        <div style={styles.topActions}>
                            <form style={styles.searchWrap} onSubmit={submitSearch}>
                                <Search size={16} color="#64748b" />
                                <input
                                    style={styles.input}
                                    placeholder="Search vouchers, invoices, parties, reports..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </form>

                            <button style={styles.btn} onClick={() => navigate("/vouchers")}>
                                <Plus size={16} />
                                New
                            </button>

                            <button style={styles.outlineBtn}>
                                <Bell size={16} />
                                Alerts
                            </button>
                        </div>
                    </header>

                    <div style={styles.content}>{children}</div>
                </main>
            </div>

            {assistantOpen ? (
                <div style={styles.assistantPanel}>
                    <div style={styles.assistantHeader}>
                        <div>
                            <div style={{ fontWeight: 800 }}>AI Assistant</div>
                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                                Available on every page
                            </div>
                        </div>
                        <button
                            onClick={() => setAssistantOpen(false)}
                            style={{ border: "none", background: "transparent", cursor: "pointer" }}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div style={styles.assistantBody}>
                        {messages.map((msg, idx) => (
                            <div key={idx} style={styles.msgWrap}>
                                <div style={styles.msg(msg.role)}>
                                    {msg.content.split("\n").map((line, i) => (
                                        <div key={i}>{line}</div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {assistantLoading ? (
                            <div style={styles.msgWrap}>
                                <div style={styles.msg("assistant")}>Thinking...</div>
                            </div>
                        ) : null}
                    </div>

                    <div style={styles.quickRow}>
                        <button style={styles.quickChip} onClick={() => sendAssistantMessage("Paid rent 5000 by bank")}>
                            Voucher help
                        </button>
                        <button style={styles.quickChip} onClick={() => sendAssistantMessage("Upload invoice")}>
                            Invoice AI
                        </button>
                        <button style={styles.quickChip} onClick={() => sendAssistantMessage("Reconcile bank")}>
                            Bank AI
                        </button>
                        <button style={styles.quickChip} onClick={() => sendAssistantMessage("Top customers")}>
                            ERP summary
                        </button>
                    </div>

                    <div style={styles.assistantFooter}>
                        <textarea
                            style={styles.assistantInput}
                            value={assistantInput}
                            onChange={(e) => setAssistantInput(e.target.value)}
                            placeholder="Ask AI anything about your ERP..."
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    sendAssistantMessage();
                                }
                            }}
                        />
                        <button style={styles.btn} onClick={() => sendAssistantMessage()}>
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            ) : null}

            <button
                style={styles.floatingBtn}
                onClick={() => setAssistantOpen(true)}
                title="Open AI Assistant"
            >
                <MessageCircle size={22} />
            </button>
        </div>
    );
}

export default AppShell;