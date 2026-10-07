import { ArrowUpRight, Check, Sparkles, Zap } from "lucide-react";
import { formatCurrency } from "../../utils/format";

/**
 * Vitrine de upgrade exibida em "Meu plano" (Central do Assinante).
 * Mostra o plano atual e o plano de 800 Mega recomendado lado a lado,
 * seguidos dos benefícios do upgrade e do CTA principal.
 */
export default function PlanUpgradeShowcase({ benefits, currentPlan, onOpenModal, priceDifference, recommendedPlan }) {
  return (
    <section aria-labelledby="plano-upgrade-heading" className="plano-upgrade-showcase">
      <div className="plano-upgrade-copy">
        <span className="home-card-eyebrow">
          <Sparkles size={16} />
          Evolua sua conexão
        </span>
        <h2 id="plano-upgrade-heading">Sua internet pode entregar ainda mais.</h2>
        <p>Conheça o plano de 800 Mega e tenha mais velocidade, entretenimento e benefícios em um único plano.</p>
      </div>

      <div className="plano-comparison-grid">
        <article className="plano-compare-card">
          <span className="plano-compare-label">Seu plano atual</span>
          <strong className="plano-compare-speed">
            {currentPlan.speedValue || "--"}
            <span>{currentPlan.speedUnit || "MEGA"}</span>
          </strong>
          <p className="plano-compare-name">{currentPlan.label}</p>

          {typeof currentPlan.price === "number" ? (
            <strong className="plano-compare-price">
              {formatCurrency(currentPlan.price)}
              <small>/mês</small>
            </strong>
          ) : null}
        </article>

        <article className="plano-compare-card is-recommended">
          <span className="plano-compare-badge">
            <Zap size={13} aria-hidden="true" />
            Mais vantagens
          </span>
          <span className="plano-compare-label">Recomendado para você</span>
          <strong className="plano-compare-speed">
            {recommendedPlan.speedValue}
            <span>{recommendedPlan.speedUnit}</span>
          </strong>
          <p className="plano-compare-name">{recommendedPlan.tagline}</p>

          <ul className="plano-compare-deltas">
            <li>
              <Check size={14} aria-hidden="true" />
              Mais velocidade
            </li>
            {benefits.map((benefit) => (
              <li key={benefit.id}>
                <Check size={14} aria-hidden="true" />
                {benefit.title}
              </li>
            ))}
          </ul>

          {typeof recommendedPlan.price === "number" ? (
            <strong className="plano-compare-price">
              {formatCurrency(recommendedPlan.price)}
              <small>/mês</small>
            </strong>
          ) : (
            <strong className="plano-compare-price plano-compare-price-muted">Consulte o valor</strong>
          )}

          {typeof priceDifference === "number" ? (
            <span className="plano-compare-diff">
              Tenha tudo isso por apenas +{formatCurrency(priceDifference)}/mês
            </span>
          ) : null}

          <div className="plano-compare-actions">
            <button
              className="home-btn home-btn-primary"
              onClick={() => onOpenModal("primary")}
              type="button"
            >
              Quero conhecer o 800 Mega
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
            <button
              className="home-btn home-btn-text"
              onClick={() => onOpenModal("secondary")}
              type="button"
            >
              Ver detalhes
            </button>
          </div>
        </article>
      </div>

      <div className="plano-benefits-grid" role="list">
        {benefits.map((benefit) => {
          const Icon = benefit.icon;
          return (
            <div className="plano-benefit-card" key={benefit.id} role="listitem">
              <span className="plano-benefit-icon">
                <Icon aria-hidden="true" size={20} />
              </span>
              <div>
                <strong>{benefit.title}</strong>
                <p>{benefit.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
