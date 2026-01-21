import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions | Financial Dojo",
  description: "Terms of Use of the Financial Dojo",
};

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-8">
          Termes et conditions
        </h1>
        
        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-6">
          <p className="text-sm text-slate-500">
            Dernière mise à jour : 17 décembre 2025
          </p>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">1. Acceptation des termes</h2>
            <p>
              En accédant et en utilisant le site web du Dojo Financier ("le Site"), vous acceptez d'être lié par ces termes et conditions. Si vous n'acceptez pas ces termes, veuillez ne pas utiliser le Site.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">2. Utilisation du service</h2>
            <p>Vous acceptez d'utiliser le Site uniquement à des fins légales et de manière qui ne viole pas les droits d'autrui. Vous vous engagez à :</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Fournir des informations exactes et à jour lors de l'inscription</li>
              <li>Maintenir la confidentialité de votre compte et de votre mot de passe</li>
              <li>Ne pas partager votre compte avec des tiers</li>
              <li>Ne pas utiliser le Site à des fins frauduleuses ou illégales</li>
              <li>Respecter tous les droits de propriété intellectuelle</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">3. Inscription et compte</h2>
            <p>
              Pour accéder à certains services, vous devez créer un compte. Vous êtes responsable de maintenir la confidentialité de vos identifiants de connexion et de toutes les activités qui se produisent sous votre compte.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">4. Paiements et remboursements</h2>
            <p>
              Les prix de nos cours sont indiqués en dollars canadiens. Les paiements sont traités de manière sécurisée via nos prestataires de paiement. 
            </p>
            <p>
              <strong>Politique de remboursement :</strong> Les remboursements sont disponibles dans les 14 jours suivant l'achat, à condition que moins de 25% du contenu du cours ait été consulté. Les demandes de remboursement doivent être soumises par écrit à admin@dojofnancier.com.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">5. Propriété intellectuelle</h2>
            <p>
              Tout le contenu du Site, y compris mais sans s'y limiter, les textes, graphiques, logos, images, vidéos, et logiciels, est la propriété du Dojo Financier ou de ses concédants de licence et est protégé par les lois sur le droit d'auteur et autres lois sur la propriété intellectuelle.
            </p>
            <p>
              Vous recevez une licence limitée, non exclusive et non transférable pour accéder et utiliser le contenu des cours que vous avez achetés uniquement à des fins personnelles et éducatives. Vous ne pouvez pas :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Reproduire, distribuer ou partager le contenu avec des tiers</li>
              <li>Utiliser le contenu à des fins commerciales</li>
              <li>Modifier ou créer des œuvres dérivées du contenu</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">6. Durée d'accès</h2>
            <p>
              L'accès aux cours est accordé pour la durée spécifiée au moment de l'achat (généralement 12 mois). L'accès expire automatiquement à la fin de la période d'accès, sauf indication contraire.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">7. Limitation de responsabilité</h2>
            <p>
              Le Dojo Financier fournit le Site et son contenu "en l'état". Nous ne garantissons pas que le Site sera exempt d'erreurs, ininterrompu ou sécurisé. Dans la mesure permise par la loi, nous déclinons toute responsabilité pour les dommages directs, indirects, accessoires ou consécutifs résultant de l'utilisation du Site.
            </p>
            <p>
              <strong>Avertissement :</strong> Le contenu éducatif fourni est à des fins d'information et d'éducation uniquement. Il ne constitue pas des conseils financiers, juridiques ou fiscaux personnalisés. Consultez toujours un professionnel qualifié pour obtenir des conseils adaptés à votre situation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">8. Résiliation</h2>
            <p>
              Nous nous réservons le droit de suspendre ou de résilier votre compte à tout moment, avec ou sans préavis, pour violation de ces termes ou pour toute autre raison que nous jugeons appropriée.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">9. Modifications des termes</h2>
            <p>
              Nous nous réservons le droit de modifier ces termes à tout moment. Les modifications entreront en vigueur dès leur publication sur le Site. Il est de votre responsabilité de consulter régulièrement ces termes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">10. Droit applicable</h2>
            <p>
              Ces termes sont régis par les lois du Québec et du Canada. Tout litige sera soumis à la juridiction exclusive des tribunaux du Québec.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">11. Contact</h2>
            <p>
              Pour toute question concernant ces termes et conditions, veuillez nous contacter :
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










