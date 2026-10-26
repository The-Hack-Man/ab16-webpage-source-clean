import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AdminLayout } from '@/components/AdminLayout';

import { HomePage } from '@/pages/HomePage';
import { ShopPage } from '@/pages/ShopPage';
import { ProductDetailPage } from '@/pages/ProductDetailPage';
import { MusicPage } from '@/pages/MusicPage';
import { ReleasesPage } from '@/pages/ReleasesPage';
import { ReleaseDetailPage } from '@/pages/ReleaseDetailPage';
import { VideosPage, VideoDetailPage } from '@/pages/VideosPage';
import { NewsPage, NewsDetailPage } from '@/pages/NewsPage';
import { EventsPage } from '@/pages/EventsPage';
import { CampaignPage } from '@/pages/CampaignPage';
import { AboutPage } from '@/pages/AboutPage';
import { AboutJamieGPage } from '@/pages/AboutJamieGPage';
import { ContactPage } from '@/pages/ContactPage';
import { FAQPage } from '@/pages/FAQPage';
import { PrivacyPage, TermsPage, CookiesPage, ShippingReturnsPage } from '@/pages/LegalPages';
import { SearchPage } from '@/pages/SearchPage';
import { BagPage } from '@/pages/BagPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { CheckoutSuccessPage } from '@/pages/CheckoutSuccessPage';
import { AccountPage, ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from '@/pages/AccountPages';
import { NotFoundPage, WishlistPage, AdminPlaceholder } from '@/pages/ExtraPages';

const MasterPage = lazy(() => import('@/pages/master/MasterPage').then(m => ({ default: m.MasterPage })));
const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview').then(m => ({ default: m.AdminOverview })));
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts').then(m => ({ default: m.AdminProducts })));
const AdminProductEdit = lazy(() => import('@/pages/admin/AdminProductEdit').then(m => ({ default: m.AdminProductEdit })));
const AdminReleases = lazy(() => import('@/pages/admin/AdminReleases').then(m => ({ default: m.AdminReleases })));
const AdminAIMastering = lazy(() => import('@/pages/admin/AdminAIMastering').then(m => ({ default: m.AdminAIMastering })));
const AdminReleaseEdit = lazy(() => import('@/pages/admin/AdminReleaseEdit').then(m => ({ default: m.AdminReleaseEdit })));
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders').then(m => ({ default: m.AdminOrders })));
const AdminOrderDetail = lazy(() => import('@/pages/admin/AdminOrderDetail').then(m => ({ default: m.AdminOrderDetail })));
const AdminInventory = lazy(() => import('@/pages/admin/AdminInventory').then(m => ({ default: m.AdminInventory })));
const AdminNewsletter = lazy(() => import('@/pages/admin/AdminNewsletter').then(m => ({ default: m.AdminNewsletter })));
const AdminEnquiries = lazy(() => import('@/pages/admin/AdminEnquiries').then(m => ({ default: m.AdminEnquiries })));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings').then(m => ({ default: m.AdminSettings })));
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })));
const AdminAlerts = lazy(() => import('@/pages/admin/AdminAlerts').then(m => ({ default: m.AdminAlerts })));
const AdminPrintful = lazy(() => import('@/pages/admin/AdminPrintful').then(m => ({ default: m.AdminPrintful })));
const AdminStripe = lazy(() => import('@/pages/admin/AdminStripe').then(m => ({ default: m.AdminStripe })));
const AdminWorkforce = lazy(() => import('@/pages/admin/AdminWorkforce').then(m => ({ default: m.AdminWorkforce })));
const AdminControlDesk = lazy(() => import('@/pages/admin/AdminControlDesk').then(m => ({ default: m.AdminControlDesk })));
const AdminWebContent = lazy(() => import('@/pages/admin/AdminWebContent').then(m => ({ default: m.AdminWebContent })));
const AdminContentHome = lazy(() => import('@/pages/admin/AdminWebContent').then(m => ({ default: m.AdminContentHome })));
const AdminUploadGuide = lazy(() => import('@/pages/admin/AdminUploadGuide').then(m => ({ default: m.AdminUploadGuide })));

function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function AdminSuspense({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayout>
      <Suspense fallback={<div className="p-8 text-slate-400 text-sm">Loading…</div>}>
        {children}
      </Suspense>
    </AdminLayout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin routes — lazy loaded, no store header/footer */}
        <Route path="/admin" element={<AdminSuspense><AdminControlDesk /></AdminSuspense>} />
        <Route path="/admin/overview" element={<AdminSuspense><AdminOverview /></AdminSuspense>} />
        <Route path="/admin/analytics" element={<AdminSuspense><AdminAnalytics /></AdminSuspense>} />
        <Route path="/admin/alerts" element={<AdminSuspense><AdminAlerts /></AdminSuspense>} />
        <Route path="/admin/workforce" element={<AdminSuspense><AdminWorkforce /></AdminSuspense>} />
        <Route path="/admin/products" element={<AdminSuspense><AdminProducts /></AdminSuspense>} />
        <Route path="/admin/products/new" element={<AdminSuspense><AdminProductEdit /></AdminSuspense>} />
        <Route path="/admin/products/:id" element={<AdminSuspense><AdminProductEdit /></AdminSuspense>} />
        <Route path="/admin/uploads" element={<AdminSuspense><AdminUploadGuide /></AdminSuspense>} />
        <Route path="/admin/inventory" element={<AdminSuspense><AdminInventory /></AdminSuspense>} />
        <Route path="/admin/orders" element={<AdminSuspense><AdminOrders /></AdminSuspense>} />
        <Route path="/admin/orders/:id" element={<AdminSuspense><AdminOrderDetail /></AdminSuspense>} />
        <Route path="/admin/printful" element={<AdminSuspense><AdminPrintful /></AdminSuspense>} />
        <Route path="/admin/stripe" element={<AdminSuspense><AdminStripe /></AdminSuspense>} />
        <Route path="/admin/customers" element={<AdminSuspense><AdminPlaceholder title="Customers" desc="Customer management with order history and profiles." /></AdminSuspense>} />
        <Route path="/admin/discounts" element={<AdminSuspense><AdminPlaceholder title="Discounts" desc="Create and manage discount codes and promotions." /></AdminSuspense>} />
        <Route path="/admin/releases" element={<AdminSuspense><AdminReleases /></AdminSuspense>} />
        <Route path="/admin/releases/new" element={<AdminSuspense><AdminReleaseEdit /></AdminSuspense>} />
        <Route path="/admin/releases/:id" element={<AdminSuspense><AdminReleaseEdit /></AdminSuspense>} />
        <Route path="/admin/ai-mastering" element={<AdminSuspense><AdminAIMastering /></AdminSuspense>} />
        <Route path="/admin/videos" element={<AdminSuspense><AdminWebContent kind="videos" /></AdminSuspense>} />
        <Route path="/admin/news" element={<AdminSuspense><AdminWebContent kind="news" /></AdminSuspense>} />
        <Route path="/admin/events" element={<AdminSuspense><AdminWebContent kind="events" /></AdminSuspense>} />
        <Route path="/admin/campaigns" element={<AdminSuspense><AdminWebContent kind="campaigns" /></AdminSuspense>} />
        <Route path="/admin/newsletter" element={<AdminSuspense><AdminNewsletter /></AdminSuspense>} />
        <Route path="/admin/enquiries" element={<AdminSuspense><AdminEnquiries /></AdminSuspense>} />
        <Route path="/admin/content" element={<AdminSuspense><AdminContentHome /></AdminSuspense>} />
        <Route path="/admin/settings" element={<AdminSuspense><AdminSettings /></AdminSuspense>} />
        <Route path="/admin/users" element={<AdminSuspense><AdminPlaceholder title="Users & Roles" desc="Manage admin users and permissions." /></AdminSuspense>} />
        <Route path="/admin/audit-log" element={<AdminSuspense><AdminPlaceholder title="Audit Log" desc="View administrative action history." /></AdminSuspense>} />

        {/* Store routes */}
        <Route path="/" element={<StoreLayout><HomePage /></StoreLayout>} />
        <Route path="/shop" element={<StoreLayout><ShopPage /></StoreLayout>} />
        <Route path="/shop/new-arrivals" element={<StoreLayout><ShopPage filter="new" /></StoreLayout>} />
        <Route path="/shop/collections" element={<StoreLayout><ShopPage filter="collection" /></StoreLayout>} />
        <Route path="/shop/collections/:slug" element={<StoreLayout><ShopPage /></StoreLayout>} />
        <Route path="/shop/:slug" element={<StoreLayout><ProductDetailPage /></StoreLayout>} />
        <Route path="/search" element={<StoreLayout><SearchPage /></StoreLayout>} />
        <Route path="/bag" element={<StoreLayout><BagPage /></StoreLayout>} />
        <Route path="/checkout" element={<StoreLayout><CheckoutPage /></StoreLayout>} />
        <Route path="/checkout/success" element={<StoreLayout><CheckoutSuccessPage /></StoreLayout>} />
        <Route path="/checkout/cancelled" element={<StoreLayout><BagPage /></StoreLayout>} />
        <Route path="/account" element={<StoreLayout><AccountPage /></StoreLayout>} />
        <Route path="/account/login" element={<StoreLayout><LoginPage /></StoreLayout>} />
        <Route path="/account/register" element={<StoreLayout><RegisterPage /></StoreLayout>} />
        <Route path="/account/forgot-password" element={<StoreLayout><ForgotPasswordPage /></StoreLayout>} />
        <Route path="/account/reset-password" element={<StoreLayout><ResetPasswordPage /></StoreLayout>} />
        <Route path="/account/orders" element={<StoreLayout><AccountPage /></StoreLayout>} />
        <Route path="/account/orders/:id" element={<StoreLayout><AccountPage /></StoreLayout>} />
        <Route path="/wishlist" element={<StoreLayout><WishlistPage /></StoreLayout>} />

        {/* Music routes */}

        {/* Audio mastering */}
        <Route path="/master" element={
          <StoreLayout>
            <Suspense fallback={<div className="container-base py-20 text-center text-slate-500">Loading the mastering studio…</div>}>
              <MasterPage />
            </Suspense>
          </StoreLayout>
        } />

        <Route path="/music" element={<StoreLayout><MusicPage /></StoreLayout>} />
        <Route path="/music/releases" element={<StoreLayout><ReleasesPage /></StoreLayout>} />
        <Route path="/music/releases/:slug" element={<StoreLayout><ReleaseDetailPage /></StoreLayout>} />
        <Route path="/music/videos" element={<StoreLayout><VideosPage /></StoreLayout>} />
        <Route path="/music/videos/:slug" element={<StoreLayout><VideoDetailPage /></StoreLayout>} />
        <Route path="/music/news" element={<StoreLayout><NewsPage /></StoreLayout>} />
        <Route path="/music/news/:slug" element={<StoreLayout><NewsDetailPage /></StoreLayout>} />
        <Route path="/music/events" element={<StoreLayout><EventsPage /></StoreLayout>} />

        {/* Brand routes */}
        <Route path="/about" element={<StoreLayout><AboutPage /></StoreLayout>} />
        <Route path="/about/jamie-g" element={<StoreLayout><AboutJamieGPage /></StoreLayout>} />
        <Route path="/contact" element={<StoreLayout><ContactPage /></StoreLayout>} />
        <Route path="/faq" element={<StoreLayout><FAQPage /></StoreLayout>} />
        <Route path="/shipping-returns" element={<StoreLayout><ShippingReturnsPage /></StoreLayout>} />
        <Route path="/privacy" element={<StoreLayout><PrivacyPage /></StoreLayout>} />
        <Route path="/terms" element={<StoreLayout><TermsPage /></StoreLayout>} />
        <Route path="/cookies" element={<StoreLayout><CookiesPage /></StoreLayout>} />

        {/* Campaign routes */}
        <Route path="/campaigns/:slug" element={<StoreLayout><CampaignPage /></StoreLayout>} />

        {/* 404 */}
        <Route path="*" element={<StoreLayout><NotFoundPage /></StoreLayout>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
