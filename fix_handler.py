#!/usr/bin/env python3
import re

# Read the file
with open(r"c:\Users\Amol G\Documents\et2.0\Workstream-AI\frontend\src\pages\VideoOnboardingMeeting.tsx", 'r') as f:
    content = f.read()

# Find and replace the handleNextQuestion function
# Pattern to match the entire function
pattern = r'  const handleNextQuestion = async \(skipAudioRecording = false\) => \{[\s\S]*?\n  \};'

# New function
new_function = '''  const handleNextQuestion = async (skipAudioRecording = false) => {
    try {
      // DOCUMENT UPLOAD
      if (skipAudioRecording && currentQuestion.question_type === 'document_upload') {
        const docName = currentQuestion.document_type || 'Document';
        setTranscripts(prev => [...prev, `${docName} uploaded`]);
      } else if (!skipAudioRecording && currentQuestion.question_type === 'document_upload') {
        toast.info('Please use the file upload button to submit your document');
        return;
      }
      // YES/NO QUESTIONS
      else if (currentQuestion.question_type === 'yes_no') {
        const answer = yesNoAnswers[currentQuestion.question_id];
        if (answer !== undefined) {
          const answerText = answer ? 'Yes' : 'No';
          setTranscripts(prev => [...prev, answerText]);
          await api.recordTextAnswer(sessionId!, currentQuestion.question_id, answerText, 5);
          toast.success(`✅ Answer recorded: ${answerText}`);
        }
      }
      // CONSENT QUESTIONS
      else if (currentQuestion.question_type === 'consent') {
        if (!consentCheckbox) {
          toast.warning('⚠️ Please check the consent checkbox');
          return;
        }
        const consentText = consentTranscript || 'Consent given';
        setTranscripts(prev => [...prev, consentText]);
        await api.recordTextAnswer(sessionId!, currentQuestion.question_id, consentText, 5);
        toast.success(`✅ Consent recorded`);
      }
      // AUDIO QUESTIONS
      else if (currentQuestion.question_type === 'audio') {
        const audioBlob = stopRecording();
        if (audioBlob) {
          setIsUploading(true);
          const duration = timeRemaining > 0 ? currentQuestion.timer_seconds - timeRemaining : currentQuestion.timer_seconds;
          try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'answer.webm');
            formData.append('question_id', currentQuestion.question_id.toString());
            const transcribeResponse = await fetch(`http://localhost:8004/api/video-onboarding/sessions/${sessionId}/transcribe-audio`, { method: 'POST', body: formData });
            if (!transcribeResponse.ok) throw new Error('Transcription failed');
            const transcribeData = await transcribeResponse.json();
            setTranscripts(prev => [...prev, transcribeData.text]);
            await api.uploadVideoAudio(sessionId!, currentQuestion.question_id, audioBlob, Math.round(audioBlob.size / 16000), Math.max(duration, 5));
            toast.success(`✅ Answer recorded`);
          } catch (err) {
            toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
          } finally {
            setIsUploading(false);
          }
        } else if (textAnswer.trim()) {
          setIsUploading(true);
          const duration = timeRemaining > 0 ? currentQuestion.timer_seconds - timeRemaining : currentQuestion.timer_seconds;
          try {
            await api.recordTextAnswer(sessionId!, currentQuestion.question_id, textAnswer.trim(), Math.max(duration, 5));
            setTranscripts(prev => [...prev, textAnswer.trim()]);
            toast.success('✅ Text answer recorded!');
          } finally {
            setIsUploading(false);
          }
        } else if (currentQuestion.required) {
          toast.warning('⚠️ Please record audio or type your answer');
          return;
        } else {
          toast.info('ℹ️ Skipping optional question');
        }
        setTextAnswer('');
      }

      // NAVIGATE TO NEXT QUESTION OR COMPLETE
      if (currentQuestionIndex < questions.length - 1) {
        const nextIndex = currentQuestionIndex + 1;
        const nextQuestion = questions[nextIndex];
        setCurrentQuestionIndex(nextIndex);
        setTimeRemaining(nextQuestion?.timer_seconds || 240);
        startQuestionTimer();
        setTimeout(() => speakQuestion(nextQuestion), 500);
      } else {
        console.log('✅ INTERVIEW COMPLETE. Transcripts:', transcripts);
        setIsUploading(true);
        try {
          await api.submitVideoOnboardingForHR(sessionId!);
          const financialData = extractFinancialData(transcripts);
          const riskLevel = calculateRiskLevel(financialData);
          const isApproved = validateConsent(consentCheckbox);
          const loanOffer = isApproved ? generateLoanOffer({
            income: parseFloat(localStorage.getItem('applicant_income') || '0'),
            riskLevel,
            purpose: localStorage.getItem('applicant_loan_purpose') || ''
          }) : null;
          const loanResult = {
            status: isApproved ? 'approved' : 'rejected',
            riskLevel,
            applicantData: {
              name: localStorage.getItem('applicant_name'),
              dob: localStorage.getItem('applicant_dob'),
              email: localStorage.getItem('applicant_email'),
              phone: localStorage.getItem('applicant_phone')
            },
            geoLocation: {
              latitude: parseFloat(localStorage.getItem('geolocation_latitude') || '0'),
              longitude: parseFloat(localStorage.getItem('geolocation_longitude') || '0')
            },
            consentGiven: consentCheckbox,
            timestamp: new Date().toISOString(),
            loanOffer
          };
          localStorage.setItem('loanApplicationResult', JSON.stringify(loanResult));
          toast.success('✅ Interview submitted!');
          setTimeout(() => navigate(`/video/loan-result/${sessionId}`), 1000);
        } catch (err: any) {
          console.error('❌ Submission error:', err);
          toast.error(err.message || 'Submission failed');
          setIsUploading(false);
        }
      }
    } catch (err: any) {
      console.error('❌ ERROR:', err);
      toast.error(err.message);
    } finally {
      setIsUploading(false);
    }
  };'''

# Replace
new_content = re.sub(pattern, new_function, content)

# Write back
with open(r"c:\Users\Amol G\Documents\et2.0\Workstream-AI\frontend\src\pages\VideoOnboardingMeeting.tsx", 'w') as f:
    f.write(new_content)

print("✅ Function replaced successfully!")
