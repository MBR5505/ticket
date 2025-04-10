import React, { useState } from 'react';
import styled from 'styled-components';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

const FAQContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: 'Arial', sans-serif;
`;

const Header = styled.h1`
  color: #2c3e50;
  text-align: center;
  margin-bottom: 2rem;
  border-bottom: 2px solid #3498db;
  padding-bottom: 1rem;
`;

const FAQSection = styled.div`
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h2`
  color: #3498db;
  margin-bottom: 1rem;
`;

const FAQItem = styled.div`
  margin-bottom: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
`;

const QuestionBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: ${props => props.isOpen ? '#f5f9ff' : '#ffffff'};
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.3s ease;
  
  &:hover {
    background-color: #f5f9ff;
  }
`;

const Answer = styled.div`
  padding: ${props => props.isOpen ? '1rem' : '0 1rem'};
  max-height: ${props => props.isOpen ? '500px' : '0'};
  overflow: hidden;
  transition: all 0.3s ease;
  opacity: ${props => props.isOpen ? '1' : '0'};
  border-top: ${props => props.isOpen ? '1px solid #e0e0e0' : 'none'};
  line-height: 1.6;
`;

const FAQSearchInput = styled.input`
  width: 100%;
  padding: 0.8rem;
  font-size: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  margin-bottom: 1.5rem;
  box-sizing: border-box;
  
  &:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }
`;

const FAQ = () => {
  const [activeIndices, setActiveIndices] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const toggleQuestion = (section, index) => {
    setActiveIndices(prev => ({
      ...prev,
      [`${section}-${index}`]: !prev[`${section}-${index}`]
    }));
  };

  const faqData = [
    {
      section: "General Issues",
      questions: [
        {
          question: "How do I reset my password?",
          answer: "To reset your password, click on the 'Forgot Password' link on the login page. You will receive an email with instructions to create a new password. Follow the link in that email and enter your new password. If you don't receive the email, check your spam folder or contact support."
        },
        {
          question: "The system is running slow, what can I do?",
          answer: "If the system is running slow, try clearing your browser cache and cookies. Restart your browser and try again. If the issue persists, check your internet connection or try using a different browser. You can also try restarting your computer."
        },
        {
          question: "How do I update my profile information?",
          answer: "To update your profile information, log in to your account and navigate to the profile section. Click on the 'Edit Profile' button and update the necessary information. Save the changes when you're done. If certain fields are not editable, contact your system administrator."
        }
      ]
    },
    {
      section: "Ticket System",
      questions: [
        {
          question: "How do I create a new ticket?",
          answer: "To create a new ticket, log in to your account and click on the 'Create New Ticket' button from your dashboard. Fill in all required information including the issue description, category, and priority level. Attach any relevant screenshots if needed and submit the form."
        },
        {
          question: "How do I check the status of my ticket?",
          answer: "To check the status of your ticket, log in to your account and go to the 'My Tickets' section. You will see a list of all your tickets with their current status. You can also click on any ticket to view more details and any updates or responses from support staff."
        },
        {
          question: "Can I update or add information to an existing ticket?",
          answer: "Yes, you can update an existing ticket. Go to the 'My Tickets' section, find the ticket you want to update, and click on it. In the ticket details page, you'll find a reply section where you can add additional comments or upload more attachments to provide further information."
        },
        {
          question: "How are ticket priorities determined?",
          answer: "Ticket priorities are determined based on the impact and urgency of the issue. High priority is for critical issues affecting multiple users or business operations. Medium priority is for issues affecting a small group of users. Low priority is for minor issues or feature requests that don't affect core functionality."
        }
      ]
    },
    {
      section: "Technical Problems",
      questions: [
        {
          question: "I can't log in to the system. What should I do?",
          answer: "If you can't log in, first ensure that you're using the correct username and password. Check if Caps Lock is turned on. Try resetting your password using the 'Forgot Password' feature. If you still can't log in, clear your browser cache and cookies, or try using a different browser. If the problem persists, contact support."
        },
        {
          question: "The application crashes frequently. How can I fix this?",
          answer: "If the application crashes frequently, make sure your browser is updated to the latest version. Clear your browser cache and cookies. Disable browser extensions that might be interfering with the application. Try using a different browser. If the issue continues, report it to support with details about when the crashes occur."
        },
        {
          question: "Why can't I see certain features that others can access?",
          answer: "Access to features is determined by your user role and permissions. If you can't see certain features, it might be because you don't have the required permissions. Contact your system administrator to request additional access if you need it for your work."
        },
        {
          question: "How do I troubleshoot connectivity issues?",
          answer: "To troubleshoot connectivity issues, check if other websites or applications are working properly to determine if it's a general internet problem. Restart your router and modem. Check your network settings. Try connecting from a different network if possible. If the issue persists, contact your IT department or internet service provider."
        }
      ]
    }
  ];

  // Filter questions based on search term
  const filteredFAQData = searchTerm.trim() === '' ? faqData : faqData.map(section => ({
    ...section,
    questions: section.questions.filter(q => 
      q.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
      q.answer.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(section => section.questions.length > 0);

  return (
    <FAQContainer>
      <Header>Frequently Asked Questions</Header>
      
      <FAQSearchInput 
        type="text" 
        placeholder="Search for questions or keywords..." 
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {filteredFAQData.map((section, sectionIdx) => (
        <FAQSection key={sectionIdx}>
          <SectionTitle>{section.section}</SectionTitle>
          {section.questions.map((item, index) => (
            <FAQItem key={index}>
              <QuestionBar 
                isOpen={activeIndices[`${sectionIdx}-${index}`]} 
                onClick={() => toggleQuestion(sectionIdx, index)}
              >
                <div>{item.question}</div>
                <div>{activeIndices[`${sectionIdx}-${index}`] ? <FaChevronUp /> : <FaChevronDown />}</div>
              </QuestionBar>
              <Answer isOpen={activeIndices[`${sectionIdx}-${index}`]}>
                {item.answer}
              </Answer>
            </FAQItem>
          ))}
        </FAQSection>
      ))}
    </FAQContainer>
  );
};

export default FAQ;
