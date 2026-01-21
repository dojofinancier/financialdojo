import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Financial Dojo",
  description: "Financial Dojo Privacy Policy",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-8">
          Politique de confidentialité
        </h1>
        
        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-6">
          <p className="text-sm text-slate-500">
            Dernière mise à jour : 17 décembre 2025
          </p>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">1. Introduction</h2>
            <p>
              Le Dojo Financier ("nous", "notre", "nos") s'engage à protéger la confidentialité de vos informations personnelles. Cette politique de confidentialité explique comment nous collectons, utilisons, divulguons et protégeons vos informations lorsque vous utilisez notre site web et nos services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">2. Informations que nous collectons</h2>
            <p>Nous collectons les types d'informations suivants :</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Informations personnelles :</strong> nom, adresse e-mail, numéro de téléphone, informations de paiement</li>
              <li><strong>Informations de compte :</strong> nom d'utilisateur, mot de passe, préférences</li>
              <li><strong>Informations d'utilisation :</strong> données sur votre utilisation de notre plateforme, progression dans les cours, résultats d'examens</li>
              <li><strong>Informations techniques :</strong> adresse IP, type de navigateur, appareil utilisé</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">3. Utilisation des informations</h2>
            <p>Nous utilisons vos informations pour :</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Fournir et améliorer nos services éducatifs</li>
              <li>Traiter vos paiements et gérer votre compte</li>
              <li>Vous envoyer des communications importantes concernant votre compte</li>
              <li>Personnaliser votre expérience d'apprentissage</li>
              <li>Analyser l'utilisation de notre plateforme pour améliorer nos services</li>
              <li>Respecter nos obligations légales</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">4. Partage des informations</h2>
            <p>
              Nous ne vendons pas vos informations personnelles. Nous pouvons partager vos informations uniquement dans les cas suivants :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Avec des prestataires de services de confiance qui nous aident à exploiter notre plateforme (processeurs de paiement, hébergeurs)</li>
              <li>Lorsque requis par la loi ou pour protéger nos droits</li>
              <li>Avec votre consentement explicite</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">5. Sécurité des données</h2>
            <p>
              Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos informations personnelles contre l'accès non autorisé, la modification, la divulgation ou la destruction. Cependant, aucune méthode de transmission sur Internet n'est 100% sécurisée.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">6. Vos droits</h2>
            <p>Vous avez le droit de :</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Accéder à vos informations personnelles</li>
              <li>Corriger des informations inexactes</li>
              <li>Demander la suppression de vos données</li>
              <li>Vous opposer au traitement de vos données</li>
              <li>Demander la portabilité de vos données</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">7. Cookies</h2>
            <p>
              Nous utilisons des cookies et des technologies similaires pour améliorer votre expérience, analyser l'utilisation de notre site et personnaliser le contenu. Vous pouvez gérer vos préférences de cookies dans les paramètres de votre navigateur.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">8. Modifications</h2>
            <p>
              Nous pouvons modifier cette politique de confidentialité de temps à autre. Nous vous informerons de tout changement important en publiant la nouvelle politique sur cette page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">9. Contact</h2>
            <p>
              Pour toute question concernant cette politique de confidentialité, veuillez nous contacter à l'adresse suivante :
            </p>
            <p className="mt-2">
              <strong>Le Dojo Financier</strong><br />
              Email : admin@dojofnancier.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}










