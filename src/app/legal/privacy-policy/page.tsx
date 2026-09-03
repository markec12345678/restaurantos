import { PRIVACY_POLICY_MD } from '../_content'

export const dynamic = 'force-dynamic'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8 sm:p-12">
        <div className="prose prose-slate max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-700">
            {PRIVACY_POLICY_MD}
          </pre>
        </div>
      </div>
    </div>
  )
}
