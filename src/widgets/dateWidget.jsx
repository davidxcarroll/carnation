import React, { useState, useEffect } from 'react';

const DateWidget = () => {
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pstDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).formatToParts(date);

  const dateParts = {
    weekday: pstDate.find(part => part.type === 'weekday').value,
    day: pstDate.find(part => part.type === 'day').value,
    month: pstDate.find(part => part.type === 'month').value,
    year: pstDate.find(part => part.type === 'year').value
  };

  return (
    <div className="row-span-3 p-20 pt-8 flex flex-col items-center justify-between bg-blue-600 text-cyan-200 text-center">
      <div className="">Today is</div>
      <div className="">{dateParts.weekday}</div>
      <div className="text-[5em] leading-[.8em]">{dateParts.day}</div>
      <div className="">{dateParts.month}</div>
      <div className="">{dateParts.year}</div>
    </div>
  );
};

export default DateWidget;