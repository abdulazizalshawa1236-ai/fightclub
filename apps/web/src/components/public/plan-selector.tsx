'use client';

import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { MessageCircle, Check } from 'lucide-react';
import { text, planRequest, whatsappLink, type PublicSite, type Locale } from '@fightclub/shared';
import { selectChoice } from './selection-keyboard';

export function PlanSelector({ site, locale }: { site: PublicSite; locale: Locale }) {
  const plans = site.plans.filter((plan) => plan.visible);
  const durations = [...new Set(plans.map((plan) => plan.durationDays))].sort((a, b) => a - b);
  const [duration, setDuration] = useState(durations[0] ?? 90);
  const selected = plans.filter((plan) => plan.durationDays === duration);
  const ar = locale === 'ar';
  const reduced = useReducedMotion();
  const selectionId = useId();
  return (
    <>
      <div
        className="fc-duration"
        role="group"
        aria-label={ar ? 'مدة الاشتراك' : 'Membership duration'}
        onKeyDown={(event) => selectChoice(event, durations, duration, setDuration, ar)}
      >
        {durations.map((days) => (
          <button
            key={days}
            type="button"
            aria-pressed={duration === days}
            onClick={() => setDuration(days)}
          >
            {duration === days && (
              <motion.span
                className="fc-choice-highlight"
                layoutId={reduced ? undefined : `${selectionId}-duration`}
                transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                aria-hidden="true"
              />
            )}
            <span className="fc-choice-label">
              {text(
                plans.find((plan) => plan.durationDays === days)!.durationLabel,
                locale,
              ).replace(/^\//, '')}
            </span>
          </button>
        ))}
      </div>
      {plans.length === 0 ? (
        <p className="fc-empty">
          {ar
            ? 'الباقات غير متاحة حالياً. تواصل مع النادي للاستفسار.'
            : 'Plans are currently unavailable. Contact the club for details.'}
        </p>
      ) : (
        <motion.div
          className="fc-plan-grid"
          key={duration}
          initial={reduced ? false : { opacity: 0.65, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.22 }}
        >
          {selected.map((plan) => {
            const href = whatsappLink(site.settings, planRequest(site, plan, locale));
            return (
              <article
                className={`fc-plan ${plan.featured ? 'fc-plan-featured' : ''}`}
                key={plan.id}
              >
                <div className="fc-plan-top">
                  <span>
                    {plan.sportLimit === null
                      ? 'VIP'
                      : ar
                        ? plan.sportLimit === 1
                          ? 'رياضة واحدة'
                          : plan.sportLimit === 2
                            ? 'رياضتان'
                            : `${new Intl.NumberFormat(locale).format(plan.sportLimit)} رياضات`
                        : plan.sportLimit === 1
                          ? 'One sport'
                          : `${plan.sportLimit} sports`}
                  </span>
                  {(plan.badge && text(plan.badge, locale)) || plan.featured ? (
                    <span className="fc-tag">
                      {plan.badge && text(plan.badge, locale)
                        ? text(plan.badge, locale)
                        : ar
                          ? 'باقة مميزة'
                          : 'Featured'}
                    </span>
                  ) : null}
                </div>
                <h3>{text(plan.name, locale)}</h3>
                <div className="fc-price">
                  {plan.oldPrice !== null && plan.oldPrice > plan.price && (
                    <del>{new Intl.NumberFormat(locale).format(plan.oldPrice)}</del>
                  )}
                  <strong>{new Intl.NumberFormat(locale).format(plan.price)}</strong>
                  <span>
                    {plan.currency === 'SAR' && site.settings.currencyLabel
                      ? text(site.settings.currencyLabel, locale)
                      : ar && plan.currency === 'SAR'
                        ? 'ر.س'
                        : plan.currency}
                  </span>
                </div>
                <p className="fc-plan-duration">
                  {text(plan.durationLabel, locale).replace(/^\//, '')}{' '}
                  <span>
                    ({new Intl.NumberFormat(locale).format(plan.durationDays)}{' '}
                    {ar ? 'يوماً' : 'days'})
                  </span>
                </p>
                <ul>
                  {plan.benefits.map((benefit, index) => (
                    <li key={index}>
                      <Check size={17} aria-hidden="true" />
                      {text(benefit, locale)}
                    </li>
                  ))}
                </ul>
                {href ? (
                  <a
                    className="fc-button fc-button-wide"
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle size={18} aria-hidden="true" />
                    {ar ? 'اطلب عبر واتساب' : 'Request via WhatsApp'}
                  </a>
                ) : (
                  <span className="fc-empty">
                    {ar ? 'اتصل بالنادي لطلب الباقة' : 'Contact the club to request this plan'}
                  </span>
                )}
              </article>
            );
          })}
        </motion.div>
      )}
      <p className="fc-plan-note">
        {ar
          ? 'الطلب عبر واتساب. يؤكد فريق النادي التوفر والدفع قبل تفعيل الاشتراك.'
          : 'Request your plan on WhatsApp. The club confirms availability and payment before activating your membership.'}
      </p>
    </>
  );
}
