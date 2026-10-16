import { Link } from "react-router-dom";
import { useSiteSettings } from "../../services/siteSettingsService";

const content = {
  about: {
    title: "About Us",
    paragraphs: [
      "We help customers find technology products for work, study, gaming and everyday use.",
      "Product availability, prices, promotions and policies shown on this site are managed by the store team. Please contact us if you need help choosing a product.",
    ],
  },
  contact: {
    title: "Contact Us",
    paragraphs: [
      "Reach out to our support team using the contact details below. Include your order number when asking about an existing order.",
    ],
  },
  faq: {
    title: "Frequently Asked Questions",
    paragraphs: [
      "How do I place an order? Add available items to your cart, review the checkout summary, enter a delivery address and choose a payment method.",
      "How do I track an order? Open My Orders when signed in. Demo checkout orders in this prototype are not real payments or fulfilment requests.",
      "How do I request support? Use the Support section in your account or contact the store team.",
    ],
  },
  shipping: {
    title: "Shipping Information",
    paragraphs: [
      "Delivery availability, charges and estimated delivery dates should be confirmed at checkout. Estimates may change by location and product availability.",
      "For this coursework prototype, placing an order records a demo order only. It does not book courier service.",
    ],
  },
  returns: {
    title: "Returns & Refunds",
    paragraphs: [
      "Please contact customer support with your order number and reason for return. Eligibility, time limits and refund processing must be confirmed by the store before launch.",
      "The owner should replace this demonstration copy with the company's approved return and refund policy before production use.",
    ],
  },
  privacy: {
    title: "Privacy Policy",
    paragraphs: [
      "This coursework prototype may store demo preferences, cart data, banner settings and anonymous interaction events in the browser's local storage.",
      "Before production use, the company should publish a reviewed privacy policy covering data collected, purpose, retention, sharing, consent and customer rights.",
    ],
  },
  terms: {
    title: "Terms & Conditions",
    paragraphs: [
      "Product listings and demo checkout are provided for project demonstration. A completed demo checkout is not a real payment, purchase settlement or delivery commitment.",
      "The company owner should replace this placeholder with reviewed terms covering pricing, payment, fulfilment, returns, warranties and dispute handling before launch.",
    ],
  },
};

function splitFaq(paragraph) {
  const questionEnd = paragraph.indexOf("?");
  if (questionEnd <= 0) return { question: paragraph, answer: "" };
  return {
    question: paragraph.slice(0, questionEnd + 1).trim(),
    answer: paragraph.slice(questionEnd + 1).trim(),
  };
}

function StoreInfoPage({ pageKey = "about" }) {
  const settings = useSiteSettings();
  const page = content[pageKey] || content.about;
  const brandName = settings.brand?.name || "TechGear";

  return (
    <main className={`store-info-page store-info-page-${pageKey}`}>
      <nav className="store-info-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">{page.title}</strong>
      </nav>

      <article className="store-info-card">
        <p className="store-info-eyebrow">{brandName} · Information &amp; Support</p>
        <h1>{page.title}</h1>

        {pageKey === "faq" ? (
          <div className="store-info-faq-list">
            {page.paragraphs.map((paragraph, index) => {
              const { question, answer } = splitFaq(paragraph);
              return (
                <details className="store-info-faq-item" key={question} open={index === 0}>
                  <summary>{question}</summary>
                  <p className="store-info-faq-answer">{answer}</p>
                </details>
              );
            })}
          </div>
        ) : (
          page.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
        )}

        {pageKey === "contact" && (
          <div className="store-info-contact">
            {settings.contact?.email && <p><strong>Email</strong><a href={`mailto:${settings.contact.email}`}>{settings.contact.email}</a></p>}
            {settings.contact?.phone && <p><strong>Phone</strong><a href={`tel:${String(settings.contact.phone).replace(/[^+\d]/g, "")}`}>{settings.contact.phone}</a></p>}
            {settings.contact?.address && <p><strong>Address</strong><span>{settings.contact.address}</span></p>}
            {settings.contact?.hours && <p><strong>Working hours</strong><span>{settings.contact.hours}</span></p>}
          </div>
        )}

        <Link className="store-info-back" to="/products">Browse products <span aria-hidden="true">→</span></Link>
      </article>
    </main>
  );
}

export default StoreInfoPage;
