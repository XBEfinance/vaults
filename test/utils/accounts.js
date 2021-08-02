const people = {};

const setPeople = (accs) => {
  people.owner = accs[0];
  people.alice = accs[1];
  people.bob = accs[2];
};

module.exports = {
  setPeople,
  people,
};
