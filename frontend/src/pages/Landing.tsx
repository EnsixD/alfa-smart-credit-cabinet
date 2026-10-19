import { CircleUser, Play, ShieldCheck, Star, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import SiteHeader, { Logo } from "../components/SiteHeader";
import { homeOf, useAuth } from "../main";

const FEATURES = [
  [Zap, "Быстро", "Решение — от нескольких минут до 1 дня"],
  [ShieldCheck, "Удобно", "Весь процесс в одном кабинете"],
  [CircleUser, "Прозрачно", "Понятный статус заявки и условия кредита"],
  [Star, "Надёжно", "Современные технологии и защита данных"],
] as const;

const STEPS = [
  ["Потребность в финансировании", "Выберите цель и подходящий продукт"],
  ["Заполнение заявки", "Укажите данные о компании и загрузите документы"],
  ["Проверка и оценка", "Банк анализирует данные и принимает решение"],
  ["Подписание", "Подпишите договор онлайн"],
  ["Получение средств", "Деньги поступают на ваш счёт"],
];

export default function Landing() {
  const { user } = useAuth();
  const apply = user ? (user.role === "CLIENT" ? "/cabinet/new" : homeOf(user)) : "/login";
  const cabinet = user ? homeOf(user) : "/login";
  return (
    <div className="landing">
      <SiteHeader />

      <section className="hero">
        <div className="hero-copy">
          <h1 className="anim-hero">Кредитный кабинет <span>предпринимателя</span></h1>
          <p className="hero-lead anim-hero d1">Оформите кредит для бизнеса онлайн — от заявки до результата в одном кабинете.</p>
          <div className="hero-cta anim-hero d2">
            <Link to={apply} className="btn btn-lg">Оставить заявку</Link>
            <a href="#how" className="play-link"><span className="play"><Play size={14} fill="currentColor" /></span>Как это работает</a>
          </div>
        </div>
        <div className="hero-art anim-hero d1">
          <img src="/img/hero-approved.webp" alt="Кредит одобрен — до 5 000 000 ₽" />
        </div>
      </section>

      <section className="features" id="business">
        {FEATURES.map(([Icon, t, d]) => (
          <div key={t} className="feature">
            <span className="f-icon"><Icon size={22} /></span>
            <div><b>{t}</b><p>{d}</p></div>
          </div>
        ))}
      </section>

      <section className="how" id="how">
        <h2>Как это работает</h2>
        <p className="how-lead">Цифровой кредитный конвейер объединяет клиентский путь и внутренние процессы банка.</p>
        <div className="how-steps">
          {STEPS.map(([t, d], i) => (
            <div key={t} className="how-step">
              <span className="num">{i + 1}</span>
              <b>{t}</b>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="one-place" id="credits">
        <div className="op-photo"><img src="/img/businessman.webp" alt="Предприниматель работает за ноутбуком" /></div>
        <div className="op-copy">
          <h2>Всё в одном кабинете</h2>
          <p>Следите за статусом заявки, получайте уведомления и управляйте кредитом без лишних звонков и визитов в банк.</p>
          <Link to={cabinet} className="btn">Перейти в кабинет</Link>
        </div>
      </section>

      <footer className="site-footer" id="support">
        <Logo />
        <span>Прототип для хакатона «Альфа Будущее». Данные синтетические, внешние системы смоделированы.</span>
      </footer>
    </div>
  );
}
