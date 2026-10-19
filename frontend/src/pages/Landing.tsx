import { ChevronDown, CircleUser, CreditCard, Factory, MessageSquare, Play, ShieldCheck, Star, TrendingUp, Wallet, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, money, months } from "../api";
import SiteHeader, { BRAND, Logo, scrollToId, useSectionNav } from "../components/SiteHeader";
import { homeOf, useAuth } from "../main";

const FEATURES = [
  [Zap, "Быстро", "Автоматическое решение за несколько минут, сложные заявки — за 1 рабочий день"],
  [ShieldCheck, "Удобно", "Подбор продукта, заявка, подпись и выдача — в одном кабинете"],
  [CircleUser, "Прозрачно", "Статус заявки меняется в реальном времени, причины решения видны"],
  [Star, "Надёжно", "Данные защищены, внешние проверки идут без вашего участия"],
] as const;

const STEPS = [
  ["Потребность", "Расскажите, на что нужны деньги — подберём подходящий продукт"],
  ["Заявка", "Реквизиты подставятся из профиля, документы загрузите в пару кликов"],
  ["Проверка и оценка", "Сверяем данные с реестрами и бюро историй, считаем нагрузку"],
  ["Подписание", "Подпишите договор кодом прямо в кабинете"],
  ["Деньги на счёте", "Средства зачисляются на расчётный счёт, график — в кабинете"],
];

const FAQ = [
  ["Кто может получить кредит?", "Индивидуальные предприниматели и компании малого бизнеса, которые работают от 1 месяца (для бизнес-карты) до 2 лет (для инвестиционного кредита). Требования к каждому продукту видны при подборе."],
  ["Какие документы понадобятся?", "Для экспресс-кредита, овердрафта и бизнес-карты — никаких: мы используем данные счёта и госреестров. Для кредита на развитие нужна бухгалтерская отчётность, для инвестиционного — ещё документы на залог."],
  ["Влияет ли предварительная оценка на кредитную историю?", "Нет. При подборе продукта мы считаем шанс одобрения по данным вашего счёта, без запроса в бюро. Запрос делается только после отправки заявки и с вашего согласия."],
  ["Что будет, если банк не одобрит запрошенную сумму?", "Мы не ограничиваемся отказом: предложим больший срок, меньшую сумму или другой продукт и покажем, чем предложение отличается от запроса."],
  ["Можно ли оформить заявку за руководителя?", "Да. Бухгалтер или сотрудник может заполнить заявку и загрузить документы, а договор подпишет руководитель в своём кабинете."],
];

const P_ICONS: Record<string, any> = { EXPRESS: Zap, OVERDRAFT: Wallet, GROWTH: TrendingUp, INVEST: Factory, CARD: CreditCard };

/** Появление элементов .sr при прокрутке до них. */
function useScrollReveal(deps: unknown[]) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".sr:not(.in)"));
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { rootMargin: "0px 0px -8% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default function Landing() {
  const { user } = useAuth();
  const loc = useLocation();
  const go = useSectionNav();
  const [products, setProducts] = useState<any[]>([]);
  const [faq, setFaq] = useState<number | null>(0);
  const apply = user ? (user.role === "CLIENT" ? "/cabinet/new" : homeOf(user)) : "/login";
  const cabinet = user ? homeOf(user) : "/login";
  useEffect(() => { api("/api/catalog/products").then(setProducts).catch(() => {}); }, []);
  useScrollReveal([products.length]);
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || !loc.hash) return;
    const el = document.getElementById(loc.hash.slice(1));
    if (el) { scrolled.current = true; setTimeout(() => scrollToId(el.id), 80); }
  }, [loc.hash, products.length]);

  return (
    <div className="landing page-enter">
      <SiteHeader />

      <section className="hero">
        <div className="hero-copy">
          <h1 className="hero-title"><span>Кредит для бизнеса</span> <span>от заявки до денег</span> <span>в одном кабинете</span></h1>
          <p className="hero-lead">Подберите продукт под задачу, отправьте заявку за несколько минут и следите за решением в реальном времени — без звонков и визитов в банк.</p>
          <div className="hero-cta">
            <Link to={apply} className="btn btn-lg">Оставить заявку</Link>
            <button className="play-link" onClick={() => go("how")}><span className="play"><Play size={14} fill="currentColor" /></span>Как это работает</button>
          </div>
          <dl className="hero-facts">
            <div><dt>до 150 млн ₽</dt><dd>максимальная сумма</dd></div>
            <div><dt>5 минут</dt><dd>автоматическое решение</dd></div>
            <div><dt>0 визитов</dt><dd>всё онлайн</dd></div>
          </dl>
        </div>
        <div className="hero-art"><img src="/img/hero-approved.webp" alt="Уведомление «Кредит одобрен» на экране ноутбука" /></div>
      </section>

      <section className="features" id="business">
        {FEATURES.map(([Icon, t, d], i) => (
          <div key={t} className="feature sr" style={{ ["--d" as any]: `${i * 0.08}s` }}>
            <span className="f-icon"><Icon size={22} /></span>
            <div><b>{t}</b><p>{d}</p></div>
          </div>
        ))}
      </section>

      <section className="credits" id="credits">
        <div className="sec-head sr"><h2>Кредиты для бизнеса</h2><p>Пять продуктов под разные задачи — от кассового разрыва до покупки оборудования.</p></div>
        <div className="product-grid">
          {products.map((p, i) => {
            const Icon = P_ICONS[p.code] || Wallet;
            return (
              <Link key={p.code} to={apply} className="product-card sr" style={{ ["--d" as any]: `${i * 0.06}s` }}>
                <span className="pc-ico"><Icon size={20} /></span>
                <b>{p.name}</b>
                <p>{p.short}</p>
                <dl>
                  <div><dt>Сумма</dt><dd>до {money(p.max_amount)}</dd></div>
                  <div><dt>Срок</dt><dd>до {months(p.max_term)}</dd></div>
                  <div><dt>Ставка</dt><dd>от {p.base_rate}%</dd></div>
                </dl>
                <span className="pc-cta">Оформить</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="how" id="how">
        <div className="sec-head sr"><h2>Как это работает</h2><p>Цифровой кредитный конвейер объединяет ваши действия и проверки банка в один понятный путь.</p></div>
        <ol className="how-steps">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="how-step sr" style={{ ["--d" as any]: `${i * 0.08}s` }}>
              <span className="num">{i + 1}</span>
              <b>{t}</b>
              <p>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="one-place">
        <div className="op-photo sr"><img src="/img/businessman.webp" alt="Предприниматель работает за ноутбуком у окна" /></div>
        <div className="op-copy sr" style={{ ["--d" as any]: ".1s"}}>
          <h2>Всё в одном кабинете</h2>
          <p>Следите за статусом заявки, отвечайте на запросы банка, подписывайте договор и смотрите график платежей — без писем, звонков и визитов в отделение.</p>
          <Link to={cabinet} className="btn">Перейти в кабинет</Link>
        </div>
      </section>

      <section className="support" id="support">
        <div className="sec-head sr"><h2>Вопросы и поддержка</h2><p>Коротко о главном. Если ответа нет — напишите нам в чат кабинета.</p></div>
        <div className="support-grid">
          <div className="faq">
            {FAQ.map(([q, a], i) => (
              <div key={q} className={"faq-item sr" + (faq === i ? " open" : "")} style={{ ["--d" as any]: `${i * 0.05}s` }}>
                <button onClick={() => setFaq(faq === i ? null : i)} aria-expanded={faq === i}>{q}<ChevronDown size={18} /></button>
                <div className="faq-a"><p>{a}</p></div>
              </div>
            ))}
          </div>
          <aside className="contact sr">
            <span className="f-icon"><MessageSquare size={22} /></span>
            <b>Чат с кредитным специалистом</b>
            <p>В кабинете у каждой заявки есть чат: специалист ответит на вопросы по условиям, документам и решению. Ещё есть помощник, который объясняет термины и статус заявки.</p>
            <Link to={cabinet} className="btn btn-ghost">Написать в кабинете</Link>
          </aside>
        </div>
      </section>

      <footer className="site-footer">
        <div className="ft-brand"><Logo /><p>{BRAND} — прототип цифрового кредитного кабинета для малого бизнеса. Данные синтетические, внешние системы смоделированы.</p></div>
        <nav className="ft-cols">
          <div><b>Продукты</b>{products.slice(0, 5).map((p) => <Link key={p.code} to={apply}>{p.name}</Link>)}</div>
          <div><b>Сервис</b><button onClick={() => go("how")}>Как это работает</button><button onClick={() => go("support")}>Вопросы и ответы</button><Link to={cabinet}>Личный кабинет</Link></div>
        </nav>
      </footer>
    </div>
  );
}
