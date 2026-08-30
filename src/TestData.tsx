import React from "react";

export default function TestData() {
  const kundali = [
    {
      name: "raju",
      dob: "14-05-2026",
      bot: "06:15 am",
      bop: "ganjam, odisha, chhattisgarh",
      gender: "male",
    },
    {
      name: "raju",
      dob: "14-05-2026",
      bot: "06:15 am",
      bop: "ganjam, odisha, chhattisgarh",
      gender: "male",
    },
    {
      name: "raju",
      dob: "14-05-2026",
      bot: "06:15 am",
      bop: "ganjam, odisha, chhattisgarh",
      gender: "male",
    },
    {
      name: "raju",
      dob: "14-05-2026",
      bot: "06:15 am",
      bop: "ganjam, odisha, chhattisgarh",
      gender: "male",
    },
    {
      name: "raju",
      dob: "14-05-2026",
      bot: "06:15 am",
      bop: "ganjam, odisha, chhattisgarh",
      gender: "male",
    },
    {
      name: "raju",
      dob: "14-05-2026",
      bot: "06:15 am",
      bop: "ganjam, odisha, chhattisgarh",
      gender: "male",
    },
  ];
  return (
    <div>
      
      {kundali.map((item, index) => (
        <div key={index}>
          {item.name}
          <br />
          {item.dob}
          <br />
          {item.bot}
          <br />
          {item.bop}
          <br />
          {item.gender}
          <br />
        </div>
      ))}
    </div>
  );
}
