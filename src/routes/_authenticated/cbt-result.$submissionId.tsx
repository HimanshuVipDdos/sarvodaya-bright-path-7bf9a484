// Score Calculation Logic (Client side for instant feedback)
const calculateResult = (userAnswers, correctAnswers) => {
  let score = 0;
  let correct = 0;
  let wrong = 0;

  Object.keys(userAnswers).forEach(qId => {
    if (userAnswers[qId] === correctAnswers[qId]) {
      score += 4; // Assume +4
      correct++;
    } else {
      score -= 1; // Negative marking
      wrong++;
    }
  });
  return { score, correct, wrong };
};

// Result UI Component
export function ResultDisplay({ submission }) {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold">Test Results</h2>
      <div className="grid grid-cols-3 gap-4 my-6">
        <div className="p-4 bg-green-100 rounded">Score: {submission.score}</div>
        <div className="p-4 bg-blue-100 rounded">Rank: {submission.rank}</div>
        <div className="p-4 bg-yellow-100 rounded">Accuracy: {submission.accuracy}%</div>
      </div>
      {/* Comparison with Topper */}
      <div className="bg-white p-4 border rounded">
        <p>Your Rank: {submission.rank}</p>
        <p>Topper Rank: 1 (Score: {submission.topperScore})</p>
      </div>
    </div>
  );
}
