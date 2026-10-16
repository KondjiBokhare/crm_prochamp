import "../../styles/store.css";
import HeroBanner from "../../components/home/HeroBanner";
import PromoBannerSection from "../../components/home/PromoBannerSection";
import BestSellingSection from "../../components/home/BestSellingSection";
import RecommendedProductsSection from "../../components/home/RecommendedProductsSection";
import DealsSection from "../../components/home/DealsSection";
import BuildPcBanner from "../../components/home/BuildPcBanner";
import ShopByPurpose from "../../components/home/ShopByPurpose";
import FeaturedBrands from "../../components/home/FeaturedBrands";
import WhyChooseTechGear from "../../components/home/WhyChooseTechGear";
import { useSiteSettings } from "../../services/siteSettingsService";

function Home() {
  const settings = useSiteSettings();
  const sections = settings.homepage?.sections || {};
  const purposes = settings.homepage?.purposes || [];
  const benefits = settings.homepage?.benefits || [];

  return (
    <div className="home-page">
      {sections.hero?.enabled !== false && <HeroBanner benefits={settings.homepage?.heroBenefits || []} />}
      {sections.promos?.enabled !== false && <PromoBannerSection />}
      {sections.bestSelling?.enabled !== false && <BestSellingSection title={sections.bestSelling?.title} subtitle={sections.bestSelling?.subtitle} />}
      <RecommendedProductsSection />
      {sections.deals?.enabled !== false && <DealsSection title={sections.deals?.title} subtitle={sections.deals?.subtitle} />}
      {sections.buildPc?.enabled !== false && <BuildPcBanner config={sections.buildPc} />}
      {sections.purposes?.enabled !== false && <ShopByPurpose title={sections.purposes?.title} subtitle={sections.purposes?.subtitle} items={purposes} />}
      {sections.brands?.enabled !== false && <FeaturedBrands title={sections.brands?.title} subtitle={sections.brands?.subtitle} />}
      {sections.benefits?.enabled !== false && <WhyChooseTechGear title={sections.benefits?.title} subtitle={sections.benefits?.subtitle} items={benefits} />}
    </div>
  );
}

export default Home;
