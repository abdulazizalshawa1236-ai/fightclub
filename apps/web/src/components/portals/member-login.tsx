'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, KeyRound, LoaderCircle, MessageCircle, ShieldCheck } from 'lucide-react';
import type { Locale, MemberLoginChallenge } from '@fightclub/shared';
import { api } from '@/lib/api';
import { Feedback, Field, Toggle, jsonRequest, label, say, submit, useMutation } from './ui';

export function MemberBrand({ locale }: { locale: Locale }) {
  return (
    <Link
      className="member-brand"
      href={`/${locale}`}
      aria-label={say(locale, 'Fight Club home', 'الصفحة الرئيسية لفايت كلوب')}
    >
      <Image src="/assets/favicon.png" alt="" width={54} height={54} />
      <span>
        FIGHT CLUB<small>{say(locale, 'Member area', 'بوابة الأعضاء')}</small>
      </span>
    </Link>
  );
}

export function MemberLogin({ locale, onSuccess }: { locale: Locale; onSuccess: () => void }) {
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [authConsent, setAuthConsent] = useState(false);
  const [challenge, setChallenge] = useState<MemberLoginChallenge | null>(null);
  const [code, setCode] = useState('');
  const action = useMutation();
  const reduced = useReducedMotion();
  const previewCode = challenge?.demoCode ?? challenge?.developmentCode;
  const hostedDemo = challenge?.demoCode !== undefined;
  async function request() {
    const result = await action.run(() =>
      api<MemberLoginChallenge>(
        '/member/login',
        jsonRequest('POST', { nationalId, phone, authConsent, locale }),
      ),
    );
    if (result) {
      setCode('');
      setChallenge(result);
    }
  }
  async function verify() {
    const result = await action.run(() =>
      api<{ ok: boolean }>(
        '/member/verify',
        jsonRequest('POST', { challengeId: challenge?.challengeId, code }),
      ),
    );
    if (result) onSuccess();
  }
  return (
    <div className="member-login-shell">
      <header className="member-topbar">
        <MemberBrand locale={locale} />
        <Link className="member-language" href={`/${locale === 'ar' ? 'en' : 'ar'}/account`}>
          {locale === 'ar' ? 'English' : 'العربية'}
        </Link>
      </header>
      <motion.div
        className="member-login-grid"
        initial={reduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <section className="member-login-story">
          <div className="member-story-art">
            <Image
              src="/assets/logo-interior.png"
              alt={say(locale, 'Fight Club brand artwork', 'هوية فايت كلوب')}
              fill
              priority
              sizes="(max-width: 760px) 100vw, 52vw"
            />
          </div>
          <div className="member-story-copy">
            <span className="member-story-tag">
              {say(locale, 'Your club. Your corner.', 'ناديك. مكانك.')}
            </span>
            <h1>{say(locale, 'Every round starts with you.', 'كل جولة تبدأ منك.')}</h1>
            <p>
              {say(
                locale,
                'Your membership, training schedule and club updates. Together in your corner.',
                'اشتراكك، جدول تدريبك، ومستجدات النادي. كل ما تحتاجه في مكان واحد.',
              )}
            </p>
            <Link className="member-story-link" href={`/${locale}#schedule`}>
              {say(locale, 'Explore the class schedule', 'استكشف جدول الحصص')}
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
        <section className="member-login-form">
          <div className="member-auth-icon">
            <KeyRound size={24} />
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={challenge ? 'verify' : 'details'}
              initial={reduced ? false : { opacity: 0, x: locale === 'ar' ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.18 }}
            >
              <h2>
                {say(
                  locale,
                  challenge
                    ? previewCode
                      ? 'Complete your demo login'
                      : 'Verify your number'
                    : 'Welcome to your corner',
                  challenge
                    ? previewCode
                      ? 'أكمل الدخول التجريبي'
                      : 'تحقق من رقمك'
                    : 'أهلاً بك في ناديك',
                )}
              </h2>
              <p className="member-muted">
                {say(
                  locale,
                  challenge
                    ? previewCode !== undefined
                      ? 'Enter the demonstration code shown below. No SMS was sent.'
                      : `Enter the code sent by SMS to ${challenge.maskedPhone}.`
                    : 'Sign in with the ID and mobile number registered by the club.',
                  challenge
                    ? previewCode !== undefined
                      ? 'أدخل الرمز التجريبي الظاهر أدناه. لم يتم إرسال رسالة نصية.'
                      : `أدخل الرمز المرسل برسالة نصية إلى ${challenge.maskedPhone}.`
                    : 'ادخل باستخدام الهوية ورقم الجوال المسجلين لدى النادي.',
                )}
              </p>
              {challenge ? (
                <form onSubmit={submit(verify)}>
                  {previewCode !== undefined && (
                    <div className="member-local-code" role="status">
                      <strong>
                        {say(
                          locale,
                          hostedDemo ? 'Stakeholder demonstration code' : 'Local preview code',
                          hostedDemo ? 'رمز العرض التجريبي' : 'رمز الاختبار المحلي',
                        )}
                      </strong>
                      <p dir="ltr">{previewCode}</p>
                      <small>
                        {say(
                          locale,
                          hostedDemo
                            ? 'Test environment only. No SMS was sent. This does not verify phone ownership.'
                            : 'No SMS was sent. Local testing only.',
                          hostedDemo
                            ? 'للبيئة التجريبية فقط. لم يتم إرسال رسالة نصية، ولا يُثبت هذا الدخول ملكية رقم الجوال.'
                            : 'لم يتم إرسال رسالة نصية. للاختبار المحلي فقط.',
                        )}
                      </small>
                    </div>
                  )}
                  <Field label={say(locale, 'Verification code', 'رمز التحقق')}>
                    <input
                      autoFocus
                      type="text"
                      required
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      autoComplete="one-time-code"
                      dir="ltr"
                      className="member-code-input"
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                    />
                  </Field>
                  <button
                    className="primary member-submit"
                    type="submit"
                    disabled={action.pending || code.length !== 6}
                  >
                    {action.pending ? (
                      <LoaderCircle className="member-spin" size={18} />
                    ) : (
                      <ShieldCheck size={18} />
                    )}
                    {say(
                      locale,
                      action.pending ? 'Verifying…' : 'Verify and sign in',
                      action.pending ? 'جارٍ التحقق…' : 'تحقق وسجّل الدخول',
                    )}
                  </button>
                  <button
                    className="member-text-button"
                    type="button"
                    disabled={action.pending}
                    onClick={() => {
                      setChallenge(null);
                      setCode('');
                      action.clear();
                    }}
                  >
                    {say(
                      locale,
                      'Request another code or change details',
                      'طلب رمز آخر أو تعديل البيانات',
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={submit(request)}>
                  <Field label={label(locale, 'nationalId')}>
                    <input
                      required
                      dir="ltr"
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      maxLength={10}
                      autoComplete="off"
                      placeholder={say(
                        locale,
                        'Your 10-digit ID',
                        'رقم الهوية المكوّن من ١٠ أرقام',
                      )}
                      value={nationalId}
                      onChange={(event) => setNationalId(event.target.value.replace(/\D/g, ''))}
                    />
                  </Field>
                  <Field label={label(locale, 'phone')}>
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      placeholder="05XXXXXXXX"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </Field>
                  <Toggle
                    label={say(
                      locale,
                      'I agree to receive this login verification code by SMS.',
                      'أوافق على استلام رمز التحقق للدخول برسالة نصية.',
                    )}
                    checked={authConsent}
                    onChange={setAuthConsent}
                  />
                  <button
                    className="primary member-submit"
                    disabled={!authConsent || action.pending}
                    type="submit"
                  >
                    {action.pending ? (
                      <LoaderCircle className="member-spin" size={18} />
                    ) : (
                      <MessageCircle size={18} />
                    )}
                    {say(
                      locale,
                      action.pending ? 'Requesting code…' : 'Request login code',
                      action.pending ? 'جارٍ طلب الرمز…' : 'طلب رمز الدخول',
                    )}
                  </button>
                </form>
              )}
              <Feedback action={{ ...action, success: false }} locale={locale} />
            </motion.div>
          </AnimatePresence>
          <div className="member-login-help">
            <p>
              {say(
                locale,
                'New to the club? Staff confirms your plan and payment before creating your membership.',
                'جديد في النادي؟ تؤكد الإدارة باقتك ودفعك قبل إنشاء العضوية.',
              )}
            </p>
            <Link href={`/${locale}#pricing`}>
              {say(locale, 'Explore membership plans', 'استعرض باقات الاشتراك')}
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <span className="member-security">
            <ShieldCheck size={15} />
            {say(locale, 'Your membership details stay private.', 'بيانات اشتراكك محفوظة لك وحدك.')}
          </span>
        </section>
      </motion.div>
    </div>
  );
}
