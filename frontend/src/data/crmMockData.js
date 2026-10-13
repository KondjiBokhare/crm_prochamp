// Demonstration-only CRM records. Replace this source with Django/FastAPI APIs
// through crmService.js when the backend contract is agreed.
export const crmCustomers = [
  { id: 1001, name: "Aarav Sharma", email: "aarav.sharma@example.com", phone: "+91 98765 43210", city: "Pune", status: "Active", joinedAt: "2026-08-14", totalOrders: 5, totalSpend: 126450, lastOrderDate: "2026-10-06", tags: ["High value", "Repeat"] },
  { id: 1002, name: "Priya Patel", email: "priya.patel@example.com", phone: "+91 98123 45670", city: "Mumbai", status: "Active", joinedAt: "2026-07-22", totalOrders: 3, totalSpend: 58290, lastOrderDate: "2026-10-02", tags: ["Repeat"] },
  { id: 1003, name: "Rohan Verma", email: "rohan.verma@example.com", phone: "+91 97654 32109", city: "Nashik", status: "Inactive", joinedAt: "2026-05-09", totalOrders: 1, totalSpend: 12999, lastOrderDate: "2026-06-15", tags: ["At risk"] },
  { id: 1004, name: "Sara Khan", email: "sara.khan@example.com", phone: "+91 98901 23456", city: "Pune", status: "Active", joinedAt: "2026-09-01", totalOrders: 2, totalSpend: 34990, lastOrderDate: "2026-10-08", tags: ["New customer"] },
  { id: 1005, name: "Ishaan Desai", email: "ishaan.desai@example.com", phone: "+91 98220 13579", city: "Nagpur", status: "Active", joinedAt: "2026-04-18", totalOrders: 7, totalSpend: 211750, lastOrderDate: "2026-10-09", tags: ["High value", "Repeat"] },
  { id: 1006, name: "Meera Joshi", email: "meera.joshi@example.com", phone: "+91 98989 10101", city: "Kolhapur", status: "Inactive", joinedAt: "2026-03-30", totalOrders: 2, totalSpend: 21980, lastOrderDate: "2026-07-03", tags: ["At risk"] },
  { id: 1007, name: "Kabir Singh", email: "kabir.singh@example.com", phone: "+91 97600 44556", city: "Pune", status: "Active", joinedAt: "2026-09-21", totalOrders: 1, totalSpend: 74990, lastOrderDate: "2026-10-05", tags: ["New customer"] },
  { id: 1008, name: "Ananya Rao", email: "ananya.rao@example.com", phone: "+91 98111 22334", city: "Bengaluru", status: "Active", joinedAt: "2026-06-11", totalOrders: 4, totalSpend: 93600, lastOrderDate: "2026-10-01", tags: ["Repeat"] },
];

export const crmOrders = [
  { id: "TG-2048", customerId: 1005, customerName: "Ishaan Desai", date: "2026-10-09", total: 45990, paymentStatus: "Paid", fulfillmentStatus: "Processing" },
  { id: "TG-2047", customerId: 1004, customerName: "Sara Khan", date: "2026-10-08", total: 18990, paymentStatus: "Paid", fulfillmentStatus: "Shipped" },
  { id: "TG-2046", customerId: 1001, customerName: "Aarav Sharma", date: "2026-10-06", total: 32490, paymentStatus: "Paid", fulfillmentStatus: "Delivered" },
  { id: "TG-2045", customerId: 1007, customerName: "Kabir Singh", date: "2026-10-05", total: 74990, paymentStatus: "Pending", fulfillmentStatus: "Pending" },
  { id: "TG-2044", customerId: 1002, customerName: "Priya Patel", date: "2026-10-02", total: 12990, paymentStatus: "Paid", fulfillmentStatus: "Delivered" },
  { id: "TG-2043", customerId: 1008, customerName: "Ananya Rao", date: "2026-10-01", total: 9990, paymentStatus: "Refunded", fulfillmentStatus: "Returned" },
];

export const crmInteractions = [
  { id: "INT-301", customerId: 1004, customerName: "Sara Khan", type: "Email", subject: "Order dispatch confirmation", date: "2026-10-08", owner: "Support Team", status: "Completed" },
  { id: "INT-300", customerId: 1005, customerName: "Ishaan Desai", type: "Call", subject: "Warranty and product information", date: "2026-10-08", owner: "Neha P.", status: "Completed" },
  { id: "INT-299", customerId: 1003, customerName: "Rohan Verma", type: "Email", subject: "Customer re-engagement", date: "2026-10-07", owner: "Marketing Team", status: "Pending" },
  { id: "INT-298", customerId: 1001, customerName: "Aarav Sharma", type: "Support", subject: "Delivery follow-up", date: "2026-10-06", owner: "Amit K.", status: "Completed" },
];

export const crmSegments = [
  { id: "SEG-01", name: "High-value customers", description: "Customers with lifetime spend above ₹50,000", customers: 4, updatedAt: "2026-10-08", status: "Active" },
  { id: "SEG-02", name: "Repeat buyers", description: "Customers with at least two orders", customers: 5, updatedAt: "2026-10-07", status: "Active" },
  { id: "SEG-03", name: "At-risk customers", description: "No order in the last 60 days", customers: 2, updatedAt: "2026-10-06", status: "Active" },
  { id: "SEG-04", name: "New customers", description: "First purchase in the last 30 days", customers: 2, updatedAt: "2026-10-05", status: "Draft" },
];

export const crmCampaigns = [
  { id: "CMP-101", name: "October Tech Deals", channel: "Email", audience: 1200, sent: 1140, conversions: 86, revenue: 258000, status: "Completed", date: "2026-10-02" },
  { id: "CMP-102", name: "Repeat Buyer Rewards", channel: "Email", audience: 420, sent: 410, conversions: 47, revenue: 141000, status: "Active", date: "2026-10-08" },
  { id: "CMP-103", name: "Win-back Inactive Users", channel: "SMS", audience: 280, sent: 0, conversions: 0, revenue: 0, status: "Scheduled", date: "2026-10-15" },
];

export const crmAnalytics = {
  revenueTrend: [
    { date: "2026-10-01", label: "Oct 1", revenue: 42000, orders: 18 },
    { date: "2026-10-02", label: "Oct 2", revenue: 58000, orders: 24 },
    { date: "2026-10-03", label: "Oct 3", revenue: 46000, orders: 20 },
    { date: "2026-10-04", label: "Oct 4", revenue: 69000, orders: 29 },
    { date: "2026-10-05", label: "Oct 5", revenue: 52000, orders: 22 },
    { date: "2026-10-06", label: "Oct 6", revenue: 81000, orders: 34 },
    { date: "2026-10-07", label: "Oct 7", revenue: 74000, orders: 31 },
    { date: "2026-10-08", label: "Oct 8", revenue: 92000, orders: 38 },
    { date: "2026-10-09", label: "Oct 9", revenue: 87000, orders: 35 },
  ],
};


// Company-owned promotional banners shown on the customer storefront.
// Dates are intentionally broad demo dates; real publication rules belong in the backend.
export const crmBanners = [
  { id: "BN-001", name: "Homepage hero - Next Gen", eyebrow: "NEXT GEN PERFORMANCE", title: "Build. Game. Create.", subtitle: "Laptops, desktops and PC components for every creator, gamer and professional.", buttonText: "Shop Now", targetUrl: "/products", imageUrl: "", placement: "HERO", backgroundColor: "#061a3c", textColor: "#ffffff", status: "Active", startDate: "2026-01-01", endDate: "2027-12-31", impressions: 1240, clicks: 104, createdAt: "2026-10-01" },
  { id: "BN-002", name: "NVIDIA RTX promotion", eyebrow: "NVIDIA", title: "RTX 40 Series", subtitle: "Beyond Fast", buttonText: "Shop Now", targetUrl: "/products", imageUrl: "", placement: "PROMO", backgroundColor: "#1d670c", textColor: "#ffffff", status: "Active", startDate: "2026-01-01", endDate: "2027-12-31", impressions: 840, clicks: 91, createdAt: "2026-10-01" },
  { id: "BN-003", name: "Intel Core promotion", eyebrow: "INTEL", title: "Core 14th Gen", subtitle: "Built for the Next Era", buttonText: "Shop Now", targetUrl: "/products", imageUrl: "", placement: "PROMO", backgroundColor: "#1266bb", textColor: "#ffffff", status: "Active", startDate: "2026-01-01", endDate: "2027-12-31", impressions: 760, clicks: 68, createdAt: "2026-10-01" },
  { id: "BN-004", name: "AMD Ryzen promotion", eyebrow: "AMD", title: "RYZEN 7000 Series", subtitle: "Power to Create & Game", buttonText: "Shop Now", targetUrl: "/products", imageUrl: "", placement: "PROMO", backgroundColor: "#9b2630", textColor: "#ffffff", status: "Active", startDate: "2026-01-01", endDate: "2027-12-31", impressions: 690, clicks: 57, createdAt: "2026-10-01" },
];


// Demonstration-only CRM leads for the Lead Management module.
export const crmLeads = [
  { id: "LEAD-1001", name: "Riya Khanna", email: "riya.khanna@example.com", phone: "+91 98765 10101", company: "Northstar Studios", city: "Pune", source: "Website", status: "New", assignedTo: "Mira Marketing", score: 72, estimatedValue: 84990, createdAt: "2026-10-08", nextFollowUpAt: "2026-10-13", notes: "Asked about a creator laptop and extended warranty.", followUps: [], statusHistory: [{ status: "New", at: "2026-10-08T09:30:00.000Z", by: "System" }] },
  { id: "LEAD-1002", name: "Dev Malhotra", email: "dev.malhotra@example.com", phone: "+91 98220 11022", company: "Pixel Forge", city: "Mumbai", source: "Campaign", status: "Contacted", assignedTo: "Maya Manager", score: 61, estimatedValue: 129990, createdAt: "2026-10-05", nextFollowUpAt: "2026-10-12", notes: "Responded to the workstation campaign.", followUps: [{ id: "LFU-1001", type: "Email", summary: "Sent workstation quotation.", at: "2026-10-09T10:00:00.000Z", nextFollowUpAt: "2026-10-12", by: "Maya Manager" }], statusHistory: [{ status: "New", at: "2026-10-05T08:00:00.000Z", by: "System" }, { status: "Contacted", at: "2026-10-09T10:00:00.000Z", by: "Maya Manager" }] },
  { id: "LEAD-1003", name: "Aarohi Desai", email: "aarohi.desai@example.com", phone: "+91 97654 20123", company: "Independent", city: "Nashik", source: "Referral", status: "Qualified", assignedTo: "Mira Marketing", score: 86, estimatedValue: 58490, createdAt: "2026-10-02", nextFollowUpAt: "2026-10-12", notes: "Budget and requirements confirmed.", followUps: [{ id: "LFU-1002", type: "Call", summary: "Confirmed budget and preferred delivery date.", at: "2026-10-10T12:30:00.000Z", nextFollowUpAt: "2026-10-12", by: "Mira Marketing" }], statusHistory: [{ status: "New", at: "2026-10-02T08:00:00.000Z", by: "System" }, { status: "Contacted", at: "2026-10-07T08:30:00.000Z", by: "Mira Marketing" }, { status: "Qualified", at: "2026-10-10T12:30:00.000Z", by: "Mira Marketing" }] },
  { id: "LEAD-1004", name: "Kabir Rao", email: "kabir.rao@example.com", phone: "+91 98111 98080", company: "Rao Design Lab", city: "Bengaluru", source: "Social Media", status: "Proposal", assignedTo: "Maya Manager", score: 79, estimatedValue: 159900, createdAt: "2026-09-28", nextFollowUpAt: "2026-10-14", notes: "Proposal shared; waiting for confirmation.", followUps: [{ id: "LFU-1003", type: "Email", summary: "Shared a custom PC component quote.", at: "2026-10-10T09:00:00.000Z", nextFollowUpAt: "2026-10-14", by: "Maya Manager" }], statusHistory: [{ status: "New", at: "2026-09-28T08:00:00.000Z", by: "System" }, { status: "Contacted", at: "2026-10-01T10:00:00.000Z", by: "Maya Manager" }, { status: "Qualified", at: "2026-10-04T10:00:00.000Z", by: "Maya Manager" }, { status: "Proposal", at: "2026-10-10T09:00:00.000Z", by: "Maya Manager" }] },
  { id: "LEAD-1005", name: "Neel Shah", email: "neel.shah@example.com", phone: "+91 98901 80808", company: "Independent", city: "Pune", source: "Product Enquiry", status: "Lost", assignedTo: "Unassigned", score: 28, estimatedValue: 29990, createdAt: "2026-09-20", nextFollowUpAt: "", notes: "Budget not available this quarter.", followUps: [], statusHistory: [{ status: "New", at: "2026-09-20T08:00:00.000Z", by: "System" }, { status: "Lost", at: "2026-10-03T09:00:00.000Z", by: "Maya Manager" }] },
];
