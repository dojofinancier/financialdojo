import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Financial Dojo",
  description: "Discover the history and mission of the Financial Dojo",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-8">
          About Financial Dojo
        </h1>
        
        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-6">
          <p>
            Financial Dojo is a small team of investment professionals, traders, and investing nerds who have worked in asset management and financial planning.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">Our founder</h2>
          <p>
            The team is led by me, Miguel Romain. My background is somewhat eclectic and unusual and I will not bore you with the details of my professional adventures, but I started my career in asset management at one of Canada's big banks, managing portfolios for high-net-worth individuals.
          </p>

          <p>
            Seeing that the finance field was extremely competitive, I decided to collect professional designations. My goal was to become a Chartered Financial Analyst (CFA) and a Chartered Professional Accountant (CPA). Since I already had a bachelor's in finance and was on my way to obtaining the CFA, I went back to university to do a degree in accounting to earn the CPA designation (back then it was called CA).
          </p>

          <p>
            I earned the CFA charter and the accounting degree, but I abandoned the CPA program fairly quickly when I got my first taste of accounting work. After working in the dynamic world of asset management, the monastic work of accounting and auditing simply was not exciting enough for me.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">The journey</h2>
          <p>
            Full of confidence and energy, I decided to try my luck in stock trading. I jumped straight into options trading and took a monumental beating fairly quickly. Taking a big slap in the market (or in any field) is an excellent learning experience and I recommend everyone feel the burn of failure at least once in their life!
          </p>

          <p>
            My learning curve in trading and options was fast and a few years later I was navigating the markets comfortably. In principle I was living la dolce vita, but life as a trader is very solitary. I always thought I was a lone wolf who did not need daily human interaction, but it turns out I am a social animal after all...
          </p>

          <p>
            To satisfy my desire to communicate with other humans in a quasi-professional context, I decided to help university finance students by offering tutoring. I immediately loved the experience and realized I could learn a lot by teaching. I learned not only about finance and investing, but especially about human psychology and how people learn.
          </p>

          <p>
            That is where, with a partner, I created my first education business, which I still operate today. We helped thousands of students pass their exams, whether at university or in professional exams. We hired dozens of tutors and I continued to coach some finance courses.
          </p>

          <p>
            That entrepreneurial experience led me to create other businesses in education, marketing, and ecommerce, while continuing to teach investing to individuals and groups.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">Our mission</h2>
          <p>
            After a few years, I realized there was a gap between finance and investing in "real life" and the theory taught to students in school. At the same time, I was dismayed by the lamentable level of financial education in Quebec and Canada, even among educated people.
          </p>

          <p>
            A bit like nutrition, finance is a subject that touches everyone in society. Everyone needs money to buy a house, a car, or to retire, so there is (or should be) a strong incentive to be as smart as possible with money. Yet most people have no financial plan and only rudimentary knowledge of how to manage their finances.
          </p>

          <p>
            When I reviewed the resources available online for financial management, I realized most of them fell into one of three categories.
          </p>

          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Financial institutions that provide information in order to attract customers (basically sales pitches for their products and services).</li>
            <li>Blogs or pseudo-charlatan individual sites touting a specific investing style or strategy (including get-rich-quick programs or training that exaggerates potential returns or minimizes risks).</li>
            <li>Sites and databases providing relevant, verifiable information, but organized in a way that is only useful to finance professionals and to people who know exactly what they are looking for.</li>
          </ul>

          <p className="mt-6 font-semibold">
            That is where the idea of founding Financial Dojo came from. The goal is to provide financial education not only to finance professionals but also to everyday people. We hope to raise financial literacy and, more importantly, empower people to take control of their finances.
          </p>
        </div>
      </div>
    </div>
  );
}











